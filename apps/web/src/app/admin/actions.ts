"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { runAction } from "@/server/lib/action";
import { checkIntegrity, resolveDispute } from "@/server/services/verification";
import { createAcademy, createMetric, createTeam, demoRestore, demoTamper, recordGuardianConsent, transferAthlete } from "@/server/services/admin";
import { academySchema, metricSchema, teamSchema, transferSchema } from "@/server/validators/forms";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { approveCoach, rejectCoach, setSuspended } from "@/server/services/admin";

const id = z.string().uuid();

const userIdSchema = z.object({ userId: id });

export async function approveCoachAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, userIdSchema, async ({ userId }) => {
    const admin = await requireUser("ADMIN");
    const chain = await approveCoach(admin.id, userId);
    revalidatePath("/admin", "layout");
    return chain.tx ? `Approved. Wallet ${chain.wallet?.slice(0, 6)}…${chain.wallet?.slice(-4)} registered as a verifier on-chain.` : `Approved. ${chain.note}.`;
  });
}

export async function rejectCoachAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, userIdSchema, async ({ userId }) => {
    const admin = await requireUser("ADMIN");
    await rejectCoach(admin.id, userId);
    revalidatePath("/admin", "layout");
    return "Registration rejected. The account can't sign in.";
  });
}

export async function toggleSuspendAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ userId: id, suspend: z.enum(["0", "1"]) }), async ({ userId, suspend }) => {
    const admin = await requireUser("ADMIN");
    await setSuspended(admin.id, userId, suspend === "1");
    revalidatePath("/admin", "layout");
    return suspend === "1" ? "Suspended. Signed-in sessions stop working on the next page load." : "Reinstated.";
  });
}

// ---------------------------------------------------------------- organisation, disputes, blockchain

const refresh = () => revalidatePath("/", "layout");

export async function transferAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, transferSchema, async (input) => {
    const admin = await requireUser("ADMIN");
    await transferAthlete(admin.id, input);
    refresh();
    return "Assignment updated. History with the previous coach and team is kept.";
  });
}

export async function consentAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ athleteId: z.string().uuid() }), async ({ athleteId }) => {
    const admin = await requireUser("ADMIN");
    await recordGuardianConsent(admin.id, athleteId);
    refresh();
    return "Guardian consent recorded.";
  });
}

export async function academyAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, academySchema, async (input) => {
    const admin = await requireUser("ADMIN");
    await createAcademy(admin.id, input);
    refresh();
    return `Academy "${input.name}" created.`;
  });
}

export async function teamAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, teamSchema, async (input) => {
    const admin = await requireUser("ADMIN");
    await createTeam(admin.id, input);
    refresh();
    return `Team "${input.name}" created.`;
  });
}

export async function metricAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, metricSchema, async (input) => {
    const admin = await requireUser("ADMIN");
    await createMetric(admin.id, input);
    refresh();
    return `Metric "${input.name}" added.`;
  });
}

export async function resolveDisputeAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ disputeId: z.string().uuid(), uphold: z.enum(["1", "0"]), resolution: z.string().trim().min(5, "Add a short note for the athlete").max(500) }), async ({ disputeId, uphold, resolution }) => {
    const admin = await requireUser("ADMIN");
    await resolveDispute(admin.id, disputeId, uphold === "1", resolution);
    refresh();
    return uphold === "1" ? "Upheld: the record is back in the coach's queue." : "Dismissed.";
  });
}

export async function tamperAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ publicId: z.string(), value: z.coerce.number({ invalid_type_error: "Enter a number" }) }), async ({ publicId, value }) => {
    const admin = await requireUser("ADMIN");
    await demoTamper(admin.id, publicId, value);
    refresh();
    return `Database value of ${publicId} changed to ${value} directly, bypassing the app. Now run the integrity check.`;
  });
}

export async function restoreAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ publicId: z.string() }), async ({ publicId }) => {
    const admin = await requireUser("ADMIN");
    await demoRestore(admin.id, publicId);
    const r = await checkIntegrity(publicId, admin.id);
    // No refresh: the restore form would vanish (nothing left to restore) and hide this message.
    return `Original value restored. Integrity check: ${r.message}`;
  });
}

export async function checkAllAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({}), async () => {
    const admin = await requireUser("ADMIN");
    const ids = (await db.execute(sql`select vr.public_id from verifiable_records vr where vr.current_anchor_id is not null`)).rows as { public_id: string }[];
    let ok = 0, bad = 0, unreachable = 0;
    for (const { public_id } of ids) {
      const r = await checkIntegrity(public_id, admin.id);
      if (r.state === "MATCH") ok++;
      else if (r.state === "UNREACHABLE") unreachable++;
      else bad++;
    }
    refresh();
    return `Checked ${ids.length} anchored records: ${ok} match, ${bad} mismatch${unreachable ? `, ${unreachable} unreachable` : ""}.`;
  });
}