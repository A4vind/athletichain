"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { requireUser } from "@/server/auth/current-user";
import { runAction } from "@/server/lib/action";
import { addFeedback, createAchievement, createGoal, createPerformance, createSession, setGoalStatus } from "@/server/services/activities";
import { isFile } from "@/server/services/evidence";
import { achievementSchema, feedbackSchema, goalSchema, performanceSchema, sessionSchema } from "@/server/validators/forms";

const done = () => revalidatePath("/", "layout");

export async function addSessionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const attendance: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("att_") && typeof v === "string" && v) attendance[k.slice(4)] = v;
  return runAction(form, sessionSchema, async (input) => {
    const u = await requireUser("COACH");
    await createSession(u.id, input, attendance);
    done();
    return `Session saved with attendance for ${Object.keys(attendance).length} athletes.`;
  });
}

export async function addPerformanceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("evidence");
  return runAction(form, performanceSchema, async (input) => {
    const u = await requireUser("COACH");
    const { publicId } = await createPerformance({ id: u.id, role: "COACH" }, input, isFile(file) ? file : null);
    done();
    return input.submit ? `Saved and sent to another coach for verification (${publicId}). You can't verify your own entry.` : "Result saved as coach-entered.";
  });
}

export async function addAchievementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("evidence");
  return runAction(form, achievementSchema, async (input) => {
    const u = await requireUser("COACH");
    const { publicId } = await createAchievement({ id: u.id, role: "COACH" }, input, isFile(file) ? file : null);
    done();
    return input.submit ? `Saved and sent to another coach for verification (${publicId}).` : `Saved as draft ${publicId}.`;
  });
}

export async function addGoalAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, goalSchema, async (input) => {
    const u = await requireUser("COACH");
    await createGoal(u.id, input);
    done();
    return "Goal set. The athlete has been notified.";
  });
}

export async function goalStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, z.object({ goalId: z.string().uuid(), status: z.enum(["ACHIEVED", "CANCELLED", "ACTIVE", "MISSED"]) }), async ({ goalId, status }) => {
    const u = await requireUser("COACH");
    await setGoalStatus(u.id, goalId, status);
    done();
    return `Goal marked ${status.toLowerCase()}.`;
  });
}

export async function feedbackAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, feedbackSchema, async (input) => {
    const u = await requireUser("COACH");
    await addFeedback(u.id, input);
    done();
    return "Feedback sent.";
  });
}
