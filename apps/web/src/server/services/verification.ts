/**
 * Verification workflow:
 *   DRAFT → submit → PENDING → coach approves → VERIFIED (hash stored)
 *         → coach's EIP-712 signature relayed on-chain → ANCHORED
 *   PENDING → coach rejects → REJECTED → athlete may dispute → admin upholds → PENDING again
 *   ANCHORED → integrity check finds a mismatch → INTEGRITY_WARNING (and back if restored)
 */
import "server-only";
import { hashRecord } from "@athletichain/canonical";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import {
  buildVerifyTypedData,
  chainConfigured,
  CHAIN_OFF_MESSAGE,
  checkTypedSignature,
  contractAddress,
  demoWalletForCoach,
  provider,
  readRecord,
  submitVerification,
  supportsDemoSigning,
} from "@/server/blockchain/chain";
import { activeCoachOf, coachForUser } from "./access";
import { audit } from "./audit";
import { canonicalInputFor, ensureVerifiable, getRecordByPublicId, type RecordView } from "./records";

async function notify(userId: string, type: string, title: string, link: string) {
  await db.insert(schema.notifications).values({ userId, type, title, link });
}

// ---------------------------------------------------------------- submit

/**
 * Sends a result or achievement for verification.
 * Athlete submissions go to the athlete's current coach. A coach's own entry goes to a
 * *different* approved coach at the same academy (separation of duties).
 */
export async function submitForVerification(
  userId: string,
  subject: { performanceRecordId?: string; achievementId?: string; kind: "PERFORMANCE" | "ACHIEVEMENT" | "MILESTONE"; date: string; athleteId: string },
) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) throw new AppError("UNAUTHORIZED", "Not signed in");

  let assignedCoach: string | null;
  if (user.role === "ATHLETE") {
    assignedCoach = await activeCoachOf(subject.athleteId);
    if (!assignedCoach) throw new AppError("CONFLICT", "You don't have a coach assigned yet, so nobody can verify this");
  } else {
    const me = await coachForUser(userId);
    const res = await db.execute(sql`
      select c.id from coaches c join users u on u.id = c.user_id
      where c.id <> ${me.id} and u.status = 'ACTIVE' and c.academy_id is not distinct from ${me.academyId}
      order by (c.sport_id = ${me.sportId}) desc, c.public_code limit 1`);
    assignedCoach = (res.rows[0] as { id: string } | undefined)?.id ?? null;
    if (!assignedCoach) throw new AppError("CONFLICT", "No other approved coach at your academy can verify your own entry");
  }

  return db.transaction(async (tx) => {
    const vr = await ensureVerifiable(tx, subject);
    if (vr.status !== "DRAFT" && vr.status !== "REJECTED") throw new AppError("CONFLICT", "Already submitted");
    await tx.update(schema.verifiableRecords).set({ status: "PENDING" }).where(eq(schema.verifiableRecords.id, vr.id));
    await tx.insert(schema.verificationRequests).values({ recordId: vr.id, submittedBy: userId, assignedCoach: assignedCoach! });
    const coach = await tx.query.coaches.findFirst({ where: eq(schema.coaches.id, assignedCoach!) });
    await tx.insert(schema.notifications).values({
      userId: coach!.userId,
      type: "VERIFICATION_REQUESTED",
      title: `${user.fullName} submitted ${vr.publicId} for verification`,
      link: "/coach/verifications",
    });
    await audit({ actorId: userId, action: "SUBMITTED_FOR_VERIFICATION", entity: "verifiable_record", entityId: vr.id }, tx);
    return vr;
  });
}

// ---------------------------------------------------------------- review

async function pendingRequestFor(coachId: string, publicId: string) {
  const res = await db.execute(sql`
    select r.id, r.submitted_by as "submittedBy", vr.id as "recordId", vr.status
    from verification_requests r join verifiable_records vr on vr.id = r.record_id
    where vr.public_id = ${publicId} and r.assigned_coach = ${coachId} and r.decision is null
    order by r.created_at desc limit 1`);
  const row = res.rows[0] as { id: string; submittedBy: string; recordId: string; status: string } | undefined;
  if (!row || row.status !== "PENDING") throw new AppError("NOT_FOUND", "This record is not waiting for your review");
  return row;
}

export type ApproveResult =
  | { state: "anchored"; txHash: string; blockNumber: number }
  | { state: "needs-signature"; typedData: SerializedTypedData }
  | { state: "verified-not-anchored"; reason: string };

export type SerializedTypedData = {
  domain: { name: string; version: string; chainId: string; verifyingContract: string };
  types: Awaited<ReturnType<typeof buildVerifyTypedData>>["types"];
  message: { recordKey: string; recordHash: string; verifier: string; nonce: string; deadline: string };
};

/** Coach approves: hash is fixed in the database, then anchored on-chain. */
export async function approveRecord(coachUserId: string, publicId: string): Promise<ApproveResult> {
  const coach = await coachForUser(coachUserId);
  const req = await pendingRequestFor(coach.id, publicId);
  if (req.submittedBy === coachUserId) throw new AppError("FORBIDDEN", "You cannot verify a record you submitted yourself");

  const record = await getRecordByPublicId(publicId);
  const hash = hashRecord(await canonicalInputFor(record, coach.publicCode));

  await db.transaction(async (tx) => {
    await tx
      .update(schema.verifiableRecords)
      .set({ status: "VERIFIED", verifiedBy: coach.id, verifiedAt: new Date(), canonicalHash: Buffer.from(hash, "hex") })
      .where(eq(schema.verifiableRecords.id, req.recordId));
    await tx
      .update(schema.verificationRequests)
      .set({ decision: "APPROVED", reviewedByUser: coachUserId, decidedAt: new Date() })
      .where(eq(schema.verificationRequests.id, req.id));
    await audit({ actorId: coachUserId, action: "RECORD_VERIFIED", entity: "verifiable_record", entityId: req.recordId, newValue: { hash } }, tx);
  });
  await notify(record.athleteUserId, "RECORD_VERIFIED", `Coach verified ${record.title} · ${record.display}`, "/athlete/verification");

  return anchorVerified(coachUserId, publicId);
}

/** Anchors a VERIFIED record. Signs with the local demo wallet, or asks the browser for a MetaMask signature. */
export async function anchorVerified(coachUserId: string, publicId: string, signed?: { signature: string; deadline: string }): Promise<ApproveResult> {
  const coach = await coachForUser(coachUserId);
  const record = await getRecordByPublicId(publicId);
  if (record.status !== "VERIFIED") throw new AppError("CONFLICT", `Only coach-verified records can be anchored (this one is ${record.status.toLowerCase()})`);
  if (record.verifierCode !== coach.publicCode) throw new AppError("FORBIDDEN", "Only the coach who verified this record can anchor it");
  if (!chainConfigured()) return { state: "verified-not-anchored", reason: CHAIN_OFF_MESSAGE };
  if (!coach.walletAddress) return { state: "verified-not-anchored", reason: "Link a wallet to anchor this record on-chain" };
  if (!contractAddress()) return { state: "verified-not-anchored", reason: "No contract deployed yet (run pnpm setup:local)" };

  let typed;
  try {
    typed = await buildVerifyTypedData(publicId, record.canonicalHash!, coach.walletAddress);
  } catch (err) {
    return { state: "verified-not-anchored", reason: `Blockchain unreachable: ${(err as Error).message.split("\n")[0]}` };
  }

  let signature: string;
  if (signed) {
    typed.message.deadline = BigInt(signed.deadline);
    if (checkTypedSignature(typed, signed.signature).toLowerCase() !== coach.walletAddress.toLowerCase()) {
      throw new AppError("FORBIDDEN", "That signature was not made by your linked wallet");
    }
    signature = signed.signature;
  } else if (supportsDemoSigning()) {
    const wallet = await demoWalletForCoach(coach.publicCode);
    if (wallet.address.toLowerCase() !== coach.walletAddress.toLowerCase()) {
      return { state: "verified-not-anchored", reason: "Your linked wallet is not the local demo wallet; sign with MetaMask" };
    }
    signature = await wallet.signTypedData(typed.domain, typed.types, typed.message);
  } else {
    return {
      state: "needs-signature",
      typedData: {
        domain: { ...typed.domain, chainId: typed.domain.chainId.toString() },
        types: typed.types,
        message: { ...typed.message, nonce: typed.message.nonce.toString(), deadline: typed.message.deadline.toString() },
      },
    };
  }

  const recordRow = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.publicId, publicId) });
  const chainId = Number((await provider().getNetwork()).chainId);
  try {
    const receipt = await submitVerification(typed, signature);
    await db.transaction(async (tx) => {
      const [anchor] = await tx
        .insert(schema.blockchainAnchors)
        .values({
          recordId: recordRow!.id,
          chainId,
          contractAddress: contractAddress()!,
          recordKey: Buffer.from(typed.message.recordKey.slice(2), "hex"),
          recordHash: Buffer.from(record.canonicalHash!, "hex"),
          verifierAddress: coach.walletAddress!,
          txHash: receipt.txHash,
          blockNumber: receipt.blockNumber,
          blockTime: receipt.blockTime,
          status: "CONFIRMED",
        })
        .returning();
      await tx
        .update(schema.verifiableRecords)
        .set({ status: "ANCHORED", currentAnchorId: anchor.id, lastIntegrityCheckAt: new Date() })
        .where(eq(schema.verifiableRecords.id, recordRow!.id));
      await audit({ actorId: coachUserId, action: "RECORD_ANCHORED", entity: "verifiable_record", entityId: recordRow!.id, newValue: { txHash: receipt.txHash, block: receipt.blockNumber } }, tx);
    });
    await notify(record.athleteUserId, "RECORD_ANCHORED", `${record.title} · ${record.display} is now blockchain anchored`, "/athlete/verification");
    return { state: "anchored", txHash: receipt.txHash, blockNumber: receipt.blockNumber };
  } catch (err) {
    const reason = (err as { shortMessage?: string }).shortMessage ?? (err as Error).message.split("\n")[0];
    await db.insert(schema.blockchainAnchors).values({
      recordId: recordRow!.id,
      chainId,
      contractAddress: contractAddress()!,
      recordKey: Buffer.from(typed.message.recordKey.slice(2), "hex"),
      recordHash: Buffer.from(record.canonicalHash!, "hex"),
      verifierAddress: coach.walletAddress!,
      status: "FAILED",
      error: reason.slice(0, 500),
    });
    return { state: "verified-not-anchored", reason: `Transaction failed: ${reason}` };
  }
}

export async function rejectRecord(coachUserId: string, publicId: string, reason: string) {
  const coach = await coachForUser(coachUserId);
  const req = await pendingRequestFor(coach.id, publicId);
  const record = await getRecordByPublicId(publicId);
  await db.transaction(async (tx) => {
    await tx.update(schema.verifiableRecords).set({ status: "REJECTED" }).where(eq(schema.verifiableRecords.id, req.recordId));
    await tx
      .update(schema.verificationRequests)
      .set({ decision: "REJECTED", reviewedByUser: coachUserId, decidedAt: new Date(), reason })
      .where(eq(schema.verificationRequests.id, req.id));
    await audit({ actorId: coachUserId, action: "RECORD_REJECTED", entity: "verifiable_record", entityId: req.recordId, newValue: { reason } }, tx);
  });
  await notify(record.athleteUserId, "RECORD_REJECTED", `${record.title} · ${record.display} was rejected: ${reason}`, "/athlete/verification");
}

// ---------------------------------------------------------------- integrity

export interface IntegrityResult {
  publicId: string;
  state: "MATCH" | "MISMATCH" | "NOT_ANCHORED" | "UNREACHABLE" | "NOT_VERIFIED";
  dbHash: string | null;
  storedHash: string | null;
  chainHash: string | null;
  chainVerifier: string | null;
  verifierMatches: boolean | null;
  checkedAt: string;
  message: string;
}

/** Rebuilds the record from the database, hashes it and compares with the proof. */
export async function checkIntegrity(publicId: string, actorId: string | null): Promise<IntegrityResult> {
  const r = await getRecordByPublicId(publicId);
  const base = { publicId, checkedAt: new Date().toISOString() };
  if (!r.verifierCode || !r.canonicalHash) {
    return { ...base, state: "NOT_VERIFIED", dbHash: null, storedHash: null, chainHash: null, chainVerifier: null, verifierMatches: null, message: "Not verified yet, so there is nothing to compare." };
  }
  const dbHash = hashRecord(await canonicalInputFor(r, r.verifierCode));

  if (!r.txHash) {
    const same = dbHash === r.canonicalHash;
    return {
      ...base,
      state: same ? "NOT_ANCHORED" : "MISMATCH",
      dbHash,
      storedHash: r.canonicalHash,
      chainHash: null,
      chainVerifier: null,
      verifierMatches: null,
      message: same ? "Coach verified, not anchored on-chain yet. Matches the hash fixed at verification." : "Record changed since the coach verified it.",
    };
  }

  let chain;
  try {
    chain = await readRecord(publicId);
  } catch {
    return { ...base, state: "UNREACHABLE", dbHash, storedHash: r.canonicalHash, chainHash: null, chainVerifier: null, verifierMatches: null, message: "Couldn't reach the blockchain to read the proof." };
  }
  const chainHash = chain.recordHash.replace(/^0x/, "");
  const verifierMatches = !!r.verifierWallet && chain.verifier.toLowerCase() === r.verifierWallet.toLowerCase();
  const match = chain.status !== 0 && chainHash === dbHash && verifierMatches;

  const recordRow = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.publicId, publicId) });
  const nextStatus = match ? "ANCHORED" : "INTEGRITY_WARNING";
  if (recordRow && recordRow.status !== nextStatus && (recordRow.status === "ANCHORED" || recordRow.status === "INTEGRITY_WARNING")) {
    await db.update(schema.verifiableRecords).set({ status: nextStatus, lastIntegrityCheckAt: new Date() }).where(eq(schema.verifiableRecords.id, recordRow.id));
    await audit({ actorId, action: match ? "INTEGRITY_RESTORED" : "INTEGRITY_MISMATCH", entity: "verifiable_record", entityId: recordRow.id, newValue: { dbHash, chainHash } });
    if (!match) {
      const admins = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
      for (const a of admins) await notify(a.id, "INTEGRITY_WARNING", `Integrity warning on ${publicId}: database no longer matches its blockchain proof`, "/admin/blockchain");
    }
  } else if (recordRow) {
    await db.update(schema.verifiableRecords).set({ lastIntegrityCheckAt: new Date() }).where(eq(schema.verifiableRecords.id, recordRow.id));
  }

  return {
    ...base,
    state: match ? "MATCH" : "MISMATCH",
    dbHash,
    storedHash: r.canonicalHash,
    chainHash,
    chainVerifier: chain.verifier,
    verifierMatches,
    message: match ? "Record matches blockchain proof." : "Current record does not match blockchain proof.",
  };
}

// ---------------------------------------------------------------- disputes

export async function raiseDispute(userId: string, publicId: string, reason: string) {
  const r = await getRecordByPublicId(publicId);
  if (r.athleteUserId !== userId) throw new AppError("FORBIDDEN", "You can only dispute your own records");
  if (r.status !== "REJECTED" && r.status !== "INTEGRITY_WARNING") throw new AppError("CONFLICT", "Only rejected or flagged records can be disputed");
  const open = await db.query.disputes.findFirst({ where: and(eq(schema.disputes.recordId, r.id), eq(schema.disputes.status, "OPEN")) });
  if (open) throw new AppError("CONFLICT", "There is already an open dispute for this record");
  await db.insert(schema.disputes).values({ recordId: r.id, raisedBy: userId, reason });
  const admins = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
  for (const a of admins) await notify(a.id, "DISPUTE", `Dispute raised on ${publicId}`, "/admin/disputes");
  await audit({ actorId: userId, action: "DISPUTE_RAISED", entity: "verifiable_record", entityId: r.id, newValue: { reason } });
}

export async function resolveDispute(adminId: string, disputeId: string, uphold: boolean, resolution: string) {
  const d = await db.query.disputes.findFirst({ where: and(eq(schema.disputes.id, disputeId), eq(schema.disputes.status, "OPEN")) });
  if (!d) throw new AppError("NOT_FOUND", "Open dispute not found");
  const vr = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.id, d.recordId) });
  await db.transaction(async (tx) => {
    await tx.update(schema.disputes).set({ status: uphold ? "UPHELD" : "DISMISSED", resolvedBy: adminId, resolution }).where(eq(schema.disputes.id, d.id));
    if (uphold && vr?.status === "REJECTED") {
      // Re-open for a fresh review by the athlete's current coach.
      const r = await getRecordByPublicId(vr.publicId);
      const coachId = await activeCoachOf(r.athleteId);
      if (coachId) {
        await tx.update(schema.verifiableRecords).set({ status: "PENDING" }).where(eq(schema.verifiableRecords.id, vr.id));
        await tx.insert(schema.verificationRequests).values({ recordId: vr.id, submittedBy: d.raisedBy, assignedCoach: coachId });
      }
    }
    await audit({ actorId: adminId, action: uphold ? "DISPUTE_UPHELD" : "DISPUTE_DISMISSED", entity: "dispute", entityId: d.id, newValue: { resolution } }, tx);
  });
  await notify(d.raisedBy, "DISPUTE_RESOLVED", `Your dispute on ${vr?.publicId} was ${uphold ? "upheld — the record is back in review" : "dismissed"}`, "/athlete/verification");
}

export type { RecordView };
