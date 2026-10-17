"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { requireUser } from "@/server/auth/current-user";
import { db, schema } from "@/server/db";
import { runAction } from "@/server/lib/action";
import { AppError } from "@/server/lib/errors";
import { createAchievement, createPerformance } from "@/server/services/activities";
import { athleteForUser } from "@/server/services/access";
import { changePassword } from "@/server/services/auth";
import { isFile } from "@/server/services/evidence";
import { ensureVerifiable } from "@/server/services/records";
import { createShareLink, revokeShareLink } from "@/server/services/sharing";
import { submitForVerification } from "@/server/services/verification";
import { achievementSchema, passwordChangeSchema, performanceSchema, shareSchema } from "@/server/validators/forms";

const done = () => revalidatePath("/", "layout");

export async function selfReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("evidence");
  return runAction(form, performanceSchema, async (input) => {
    const u = await requireUser("ATHLETE");
    const { publicId } = await createPerformance({ id: u.id, role: "ATHLETE" }, { ...input, athleteId: undefined }, isFile(file) ? file : null);
    done();
    return input.submit ? `Saved and sent to your coach for verification (${publicId}).` : "Saved as self-reported.";
  });
}

/** Sends one of your self-reported results to your coach. */
export async function submitResultAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ performanceId: z.string().uuid() }), async ({ performanceId }) => {
    const u = await requireUser("ATHLETE");
    const athlete = await athleteForUser(u.id);
    const perf = await db.query.performanceRecords.findFirst({ where: eq(schema.performanceRecords.id, performanceId) });
    if (!perf || perf.athleteId !== athlete.id) throw new AppError("NOT_FOUND", "Result not found");
    const metric = await db.query.sportMetrics.findFirst({ where: eq(schema.sportMetrics.id, perf.metricId) });
    if (!metric?.isAnchorable) throw new AppError("VALIDATION", "Training metrics aren't sent for verification");
    await db.transaction((tx) => ensureVerifiable(tx, { performanceRecordId: perf.id, kind: "PERFORMANCE", date: perf.recordedOn }));
    const vr = await submitForVerification(u.id, { performanceRecordId: perf.id, kind: "PERFORMANCE", date: perf.recordedOn, athleteId: athlete.id });
    done();
    return `Sent to your coach (${vr.publicId}).`;
  });
}

export async function selfAchievementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("evidence");
  return runAction(form, achievementSchema, async (input) => {
    const u = await requireUser("ATHLETE");
    const { publicId } = await createAchievement({ id: u.id, role: "ATHLETE" }, { ...input, athleteId: undefined }, isFile(file) ? file : null);
    done();
    return input.submit ? `Saved and sent to your coach (${publicId}).` : `Saved as draft ${publicId}.`;
  });
}

export async function shareAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, shareSchema, async (input) => {
    const u = await requireUser("ATHLETE");
    const link = await createShareLink(u.id, input);
    done();
    return `Link created: ${link.code}`;
  });
}

export async function revokeShareAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ linkId: z.string().uuid() }), async ({ linkId }) => {
    const u = await requireUser("ATHLETE");
    await revokeShareLink(u.id, linkId);
    done();
    return "Link revoked. Anyone opening it now sees that it was withdrawn.";
  });
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, passwordChangeSchema, async ({ current, password }) => {
    const u = await requireUser("ATHLETE");
    await changePassword(u.id, current, password);
    return "Password updated.";
  });
}
