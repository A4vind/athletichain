import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { demoWalletForCoach, registerVerifierOnChain, revokeVerifierOnChain, supportsDemoSigning } from "@/server/blockchain/chain";
import { audit } from "./audit";

export async function approveCoach(adminId: string, coachUserId: string) {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .update(schema.users)
      .set({ status: "ACTIVE" })
      .where(and(eq(schema.users.id, coachUserId), eq(schema.users.role, "COACH"), eq(schema.users.status, "PENDING_APPROVAL")))
      .returning();
    if (!user) throw new AppError("NOT_FOUND", "No pending coach with that id");
    await tx.update(schema.coaches).set({ approvedBy: adminId, approvedAt: new Date() }).where(eq(schema.coaches.userId, coachUserId));
    await tx.insert(schema.notifications).values({
      userId: coachUserId,
      type: "COACH_APPROVED",
      title: "Your coach account was approved. You can now verify athlete records.",
      link: "/coach/dashboard",
    });
    await audit({ actorId: adminId, action: "COACH_APPROVED", entity: "user", entityId: coachUserId, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "ACTIVE" } }, tx);
  });
  return connectCoachWallet(coachUserId);
}

/**
 * After approval: on the local chain the coach gets their demo wallet automatically;
 * on Sepolia they link MetaMask themselves. Either way an active coach with a wallet is
 * registered as a verifier by the relayer (the contract owner).
 */
export async function connectCoachWallet(coachUserId: string): Promise<{ wallet: string | null; tx: string | null; note: string }> {
  const coach = await db.query.coaches.findFirst({ where: eq(schema.coaches.userId, coachUserId) });
  if (!coach) throw new AppError("NOT_FOUND", "Coach not found");
  let wallet = coach.walletAddress;
  try {
    if (!wallet && supportsDemoSigning()) {
      wallet = (await demoWalletForCoach(coach.publicCode)).address;
      await db.update(schema.coaches).set({ walletAddress: wallet }).where(eq(schema.coaches.id, coach.id));
    }
    if (!wallet) return { wallet: null, tx: null, note: "Coach must link a MetaMask wallet before verifying" };
    const tx = await registerVerifierOnChain(wallet);
    if (tx) await audit({ actorId: null, action: "VERIFIER_REGISTERED", entity: "coach", entityId: coach.id, newValue: { wallet, tx } });
    return { wallet, tx, note: tx ? "Registered as verifier on-chain" : "Already registered" };
  } catch (err) {
    return { wallet, tx: null, note: `Approved, but on-chain registration failed: ${(err as Error).message.split("\n")[0]}` };
  }
}

export async function rejectCoach(adminId: string, coachUserId: string) {
  const [user] = await db
    .update(schema.users)
    .set({ status: "SUSPENDED" })
    .where(and(eq(schema.users.id, coachUserId), eq(schema.users.status, "PENDING_APPROVAL")))
    .returning();
  if (!user) throw new AppError("NOT_FOUND", "No pending coach with that id");
  await audit({ actorId: adminId, action: "COACH_REJECTED", entity: "user", entityId: coachUserId, newValue: { status: "SUSPENDED" } });
}

export async function setSuspended(adminId: string, userId: string, suspended: boolean) {
  if (adminId === userId) throw new AppError("FORBIDDEN", "You cannot suspend your own account");
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!target) throw new AppError("NOT_FOUND", "User not found");
  if (target.role === "ADMIN") throw new AppError("FORBIDDEN", "Admins cannot be suspended here");
  const next = suspended ? "SUSPENDED" : "ACTIVE";
  await db.update(schema.users).set({ status: next }).where(eq(schema.users.id, userId));
  // A suspended coach stops being a verifier on-chain too; their past proofs stay valid.
  if (target.role === "COACH") {
    const coach = await db.query.coaches.findFirst({ where: eq(schema.coaches.userId, userId) });
    if (coach?.walletAddress) {
      try {
        if (suspended) await revokeVerifierOnChain(coach.walletAddress);
        else await registerVerifierOnChain(coach.walletAddress);
      } catch {
        /* chain offline: the database status still blocks the coach */
      }
    }
  }
  await audit({ actorId: adminId, action: suspended ? "USER_SUSPENDED" : "USER_REINSTATED", entity: "user", entityId: userId, oldValue: { status: target.status }, newValue: { status: next } });
}

// ---------------------------------------------------------------- organisation

export async function transferAthlete(adminId: string, input: { athleteId: string; coachId: string; teamId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const coach = await db.query.coaches.findFirst({ where: eq(schema.coaches.id, input.coachId) });
  const coachUser = coach ? await db.query.users.findFirst({ where: eq(schema.users.id, coach.userId) }) : null;
  if (!coach || coachUser?.status !== "ACTIVE") throw new AppError("VALIDATION", "Choose an approved coach");
  await db.transaction(async (tx) => {
    const current = await tx.query.coachAssignments.findFirst({
      where: and(eq(schema.coachAssignments.athleteId, input.athleteId), isNull(schema.coachAssignments.endDate)),
    });
    if (current?.coachId !== input.coachId) {
      if (current) await tx.update(schema.coachAssignments).set({ endDate: current.startDate > yesterday ? current.startDate : yesterday }).where(eq(schema.coachAssignments.id, current.id));
      await tx.insert(schema.coachAssignments).values({ coachId: input.coachId, athleteId: input.athleteId, startDate: today });
    }
    const team = await tx.query.teamMemberships.findFirst({
      where: and(eq(schema.teamMemberships.athleteId, input.athleteId), isNull(schema.teamMemberships.endDate)),
    });
    if (team?.teamId !== input.teamId) {
      if (team) await tx.update(schema.teamMemberships).set({ endDate: team.startDate > yesterday ? team.startDate : yesterday }).where(eq(schema.teamMemberships.id, team.id));
      await tx.insert(schema.teamMemberships).values({ teamId: input.teamId, athleteId: input.athleteId, startDate: today });
    }
    await audit({ actorId: adminId, action: "ATHLETE_TRANSFERRED", entity: "athlete", entityId: input.athleteId, oldValue: { coachId: current?.coachId, teamId: team?.teamId }, newValue: input }, tx);
  });
}

export async function recordGuardianConsent(adminId: string, athleteId: string) {
  await db.update(schema.athletes).set({ guardianConsentAt: new Date() }).where(eq(schema.athletes.id, athleteId));
  await audit({ actorId: adminId, action: "GUARDIAN_CONSENT_RECORDED", entity: "athlete", entityId: athleteId });
}

export async function createAcademy(adminId: string, input: { name: string; city?: string }) {
  const [a] = await db.insert(schema.academies).values({ ...input, adminUserId: adminId }).returning();
  await audit({ actorId: adminId, action: "ACADEMY_CREATED", entity: "academy", entityId: a.id, newValue: input });
}

export async function createTeam(adminId: string, input: { academyId: string; sportId: string; name: string }) {
  const [t] = await db.insert(schema.teams).values(input).returning();
  await audit({ actorId: adminId, action: "TEAM_CREATED", entity: "team", entityId: t.id, newValue: input });
}

export async function createMetric(adminId: string, input: typeof schema.sportMetrics.$inferInsert) {
  const [m] = await db.insert(schema.sportMetrics).values(input).returning();
  await audit({ actorId: adminId, action: "METRIC_CREATED", entity: "sport_metric", entityId: m.id, newValue: { code: input.code } });
}

// ---------------------------------------------------------------- demo tools

export const demoToolsEnabled = () => process.env.NODE_ENV !== "production" || process.env.DEMO_TOOLS === "1";

/**
 * Simulates someone editing the database directly, bypassing the app (which refuses to
 * edit verified records). Used to demonstrate the integrity check. Logged in the audit log.
 */
export async function demoTamper(adminId: string, publicId: string, newValue: number) {
  if (!demoToolsEnabled()) throw new AppError("FORBIDDEN", "Demo tools are disabled");
  const vr = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.publicId, publicId) });
  if (!vr?.performanceRecordId) throw new AppError("VALIDATION", "Pick a performance record");
  const perf = await db.query.performanceRecords.findFirst({ where: eq(schema.performanceRecords.id, vr.performanceRecordId) });
  await db.update(schema.performanceRecords).set({ value: String(newValue) }).where(eq(schema.performanceRecords.id, perf!.id));
  await audit({ actorId: adminId, action: "DEMO_TAMPER", entity: "performance_record", entityId: perf!.id, oldValue: { value: perf!.value, publicId }, newValue: { value: String(newValue) } });
}

export async function demoRestore(adminId: string, publicId: string) {
  if (!demoToolsEnabled()) throw new AppError("FORBIDDEN", "Demo tools are disabled");
  const res = await db.execute(sql`
    select entity_id as id, old_value->>'value' as value from audit_logs
    where action = 'DEMO_TAMPER' and old_value->>'publicId' = ${publicId} order by at asc limit 1`);
  const row = res.rows[0] as { id: string; value: string } | undefined;
  if (!row) throw new AppError("NOT_FOUND", "No tampering recorded for this record");
  await db.update(schema.performanceRecords).set({ value: row.value }).where(eq(schema.performanceRecords.id, row.id));
  await db.execute(sql`update audit_logs set action = 'DEMO_TAMPER_RESTORED' where action = 'DEMO_TAMPER' and old_value->>'publicId' = ${publicId}`);
  await audit({ actorId: adminId, action: "DEMO_RESTORE", entity: "performance_record", entityId: row.id, newValue: { value: row.value } });
}
