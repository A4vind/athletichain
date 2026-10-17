"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { getCurrentUser } from "@/server/auth/current-user";
import { runAction } from "@/server/lib/action";
import { AppError } from "@/server/lib/errors";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { submitExisting } from "@/server/services/activities";
import { isFile } from "@/server/services/evidence";
import { assertCanView } from "@/server/services/record-access";
import { anchorVerified, approveRecord, checkIntegrity, raiseDispute, rejectRecord, type ApproveResult } from "@/server/services/verification";
import { rejectSchema } from "@/server/validators/forms";
import { verifyMessage } from "ethers";
import { connectCoachWallet } from "@/server/services/admin";
import { relayer, revokeVerifierOnChain } from "@/server/blockchain/chain";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new AppError("UNAUTHORIZED", "Please log in again");
  return u;
}

const pub = z.object({ publicId: z.string().min(3) });

/** Anyone allowed to see the record may run the check; public pages call checkIntegrity directly. */
export async function integrityAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, pub, async ({ publicId }) => {
    const u = await me();
    await assertCanView(u, publicId);
    const result = await checkIntegrity(publicId, u.id);
    revalidatePath("/", "layout");
    return { ok: result.message, data: result };
  });
}

function describe(result: ApproveResult) {
  if (result.state === "anchored") return { ok: `Verified and anchored on-chain in block ${result.blockNumber}. Tx ${result.txHash.slice(0, 10)}…`, data: result };
  if (result.state === "needs-signature") return { ok: "Verified. Now sign the record's fingerprint in MetaMask to anchor it.", data: result };
  return { ok: `Coach verified. Not anchored yet: ${result.reason}`, data: result };
}

export async function approveAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, pub, async ({ publicId }) => {
    const u = await me();
    const result = await approveRecord(u.id, publicId);
    // No revalidate here: the card stays on screen to show the result; "Next" refreshes.
    return describe(result);
  });
}

export async function anchorAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, pub, async ({ publicId }) => {
    const u = await me();
    const result = await anchorVerified(u.id, publicId);
    // No revalidate here: the card stays on screen to show the result; "Next" refreshes.
    return describe(result);
  });
}

export async function anchorWithSignature(publicId: string, signature: string, deadline: string): Promise<ActionState> {
  try {
    const u = await me();
    const result = await anchorVerified(u.id, publicId, { signature, deadline });
    return { ...describe(result), nonce: Date.now() };
  } catch (err) {
    return { error: err instanceof AppError ? err.message : "Anchoring failed", nonce: Date.now() };
  }
}

export async function rejectAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, rejectSchema, async ({ publicId, reason }) => {
    const u = await me();
    await rejectRecord(u.id, publicId, reason);
    // No revalidate here: the card stays on screen to show the result; "Next" refreshes.
    return "Rejected. The athlete has been told why.";
  });
}

export async function submitExistingAction(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("evidence");
  return runAction(form, pub, async ({ publicId }) => {
    const u = await me();
    await submitExisting({ id: u.id, role: u.role }, publicId, isFile(file) ? file : null);
    revalidatePath("/", "layout");
    return "Sent for verification.";
  });
}

export async function disputeAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ publicId: z.string(), reason: z.string().trim().min(10, "Explain the dispute in at least 10 characters").max(500) }), async ({ publicId, reason }) => {
    const u = await me();
    await raiseDispute(u.id, publicId, reason);
    revalidatePath("/", "layout");
    return "Dispute sent to the academy admin.";
  });
}

/** Sepolia: the coach proves wallet ownership by signing a message in MetaMask. */
export async function linkWalletAction(address: string, message: string, signature: string): Promise<ActionState> {
  try {
    const u = await me();
    if (u.role !== "COACH" || u.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Only approved coaches link wallets");
    const coach = await db.query.coaches.findFirst({ where: eq(schema.coaches.userId, u.id) });
    if (!message.includes(coach!.publicCode)) throw new AppError("VALIDATION", "Message does not match your account");
    const signedAt = Number(message.match(/at (\d+)$/)?.[1] ?? 0);
    if (Math.abs(Date.now() - signedAt) > 10 * 60_000) throw new AppError("VALIDATION", "Signature expired, try again");
    if (verifyMessage(message, signature).toLowerCase() !== address.toLowerCase()) throw new AppError("FORBIDDEN", "Signature does not match the wallet");
    // The relayer pays gas and owns the contract; a coach must sign with a separate wallet.
    let relayerAddress = "";
    try {
      relayerAddress = relayer().address.toLowerCase();
    } catch {
      /* no relayer key configured */
    }
    if (address.toLowerCase() === relayerAddress) {
      throw new AppError("VALIDATION", "That is the relayer wallet, which pays gas for the app. In MetaMask, pick your own coach account and try again.");
    }
    const taken = await db.query.coaches.findFirst({ where: (c, { and, ne, sql }) => and(ne(c.id, coach!.id), sql`lower(${c.walletAddress}) = ${address.toLowerCase()}`) });
    if (taken) throw new AppError("CONFLICT", "That wallet is already linked to another coach");
    const previous = coach!.walletAddress;
    await db.update(schema.coaches).set({ walletAddress: address }).where(eq(schema.coaches.id, coach!.id));
    // Switching wallets: the old one stops being a verifier. Records it already anchored stay valid.
    if (previous && previous.toLowerCase() !== address.toLowerCase()) {
      try {
        await revokeVerifierOnChain(previous);
      } catch {
        /* chain unreachable: the database link has already moved to the new wallet */
      }
    }
    const reg = await connectCoachWallet(u.id);
    revalidatePath("/", "layout");
    return { ok: `Wallet linked. ${reg.note}.`, nonce: Date.now() };
  } catch (err) {
    return { error: err instanceof AppError ? err.message : "Could not link wallet", nonce: Date.now() };
  }
}
