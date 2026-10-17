/**
 * Day-to-day coaching data: training sessions, results, achievements, goals, feedback.
 * Every write checks who is acting and on whose behalf.
 */
import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import type { achievementSchema, feedbackSchema, goalSchema, performanceSchema, sessionSchema } from "@/server/validators/forms";
import { assertCoachOfAthlete, athleteForUser, coachForUser } from "./access";
import { audit } from "./audit";
import { saveEvidence } from "./evidence";
import { ensureVerifiable } from "./records";
import { submitForVerification } from "./verification";

type Actor = { id: string; role: "ATHLETE" | "COACH" | "ADMIN" };

async function resolveAthlete(actor: Actor, athleteId?: string) {
  if (actor.role === "ATHLETE") return athleteForUser(actor.id);
  if (actor.role !== "COACH" || !athleteId) throw new AppError("FORBIDDEN", "Not allowed");
  const coach = await coachForUser(actor.id);
  await assertCoachOfAthlete(coach.id, athleteId);
  const a = await db.query.athletes.findFirst({ where: eq(schema.athletes.id, athleteId) });
  if (!a) throw new AppError("NOT_FOUND", "Athlete not found");
  return a;
}

export async function createPerformance(actor: Actor, input: z.infer<typeof performanceSchema>, file: File | null) {
  const athlete = await resolveAthlete(actor, input.athleteId);
  const metric = await db.query.sportMetrics.findFirst({ where: eq(schema.sportMetrics.id, input.metricId) });
  if (!metric || metric.sportId !== athlete.sportId) throw new AppError("VALIDATION", "That metric isn't part of this athlete's sport");
  if (input.submit && !metric.isAnchorable) throw new AppError("VALIDATION", `${metric.name} is a training metric and isn't sent for verification`);

  const [perf] = await db
    .insert(schema.performanceRecords)
    .values({
      athleteId: athlete.id,
      metricId: metric.id,
      value: String(input.value),
      recordedOn: input.recordedOn,
      eventName: input.eventName,
      conditions: input.conditions,
      notes: input.notes,
      source: actor.role === "ATHLETE" ? "SELF_REPORTED" : "COACH_ENTERED",
      enteredBy: actor.id,
    })
    .returning();
  await audit({ actorId: actor.id, action: "PERFORMANCE_ADDED", entity: "performance_record", entityId: perf.id, newValue: { metric: metric.code, value: input.value } });

  if (file || input.submit) {
    const vr = await db.transaction((tx) => ensureVerifiable(tx, { performanceRecordId: perf.id, kind: "PERFORMANCE", date: perf.recordedOn }));
    if (file) await saveEvidence(vr.id, file, actor.id);
    if (input.submit) await submitForVerification(actor.id, { performanceRecordId: perf.id, kind: "PERFORMANCE", date: perf.recordedOn, athleteId: athlete.id });
    return { perf, publicId: vr.publicId };
  }
  return { perf, publicId: null };
}

export async function createAchievement(actor: Actor, input: z.infer<typeof achievementSchema>, file: File | null) {
  const athlete = await resolveAthlete(actor, input.athleteId);
  const [ach] = await db
    .insert(schema.achievements)
    .values({
      athleteId: athlete.id,
      kind: input.kind,
      title: input.title,
      eventName: input.eventName,
      result: input.result,
      achievedOn: input.achievedOn,
      description: input.description,
      enteredBy: actor.id,
    })
    .returning();
  await audit({ actorId: actor.id, action: "ACHIEVEMENT_ADDED", entity: "achievement", entityId: ach.id, newValue: { title: input.title } });
  const vr = await db.transaction((tx) => ensureVerifiable(tx, { achievementId: ach.id, kind: input.kind, date: ach.achievedOn }));
  if (file) await saveEvidence(vr.id, file, actor.id);
  if (input.submit) await submitForVerification(actor.id, { achievementId: ach.id, kind: input.kind, date: ach.achievedOn, athleteId: athlete.id });
  return { ach, publicId: vr.publicId };
}

/** Sends an existing draft or rejected record (with any evidence) for verification. */
export async function submitExisting(actor: Actor, publicId: string, file: File | null) {
  const vr = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.publicId, publicId) });
  if (!vr) throw new AppError("NOT_FOUND", "Record not found");
  const perf = vr.performanceRecordId ? await db.query.performanceRecords.findFirst({ where: eq(schema.performanceRecords.id, vr.performanceRecordId) }) : null;
  const ach = vr.achievementId ? await db.query.achievements.findFirst({ where: eq(schema.achievements.id, vr.achievementId) }) : null;
  const athleteId = perf?.athleteId ?? ach!.athleteId;
  await resolveAthlete(actor, athleteId); // ownership
  if (file) await saveEvidence(vr.id, file, actor.id);
  await submitForVerification(actor.id, {
    performanceRecordId: perf?.id,
    achievementId: ach?.id,
    kind: perf ? "PERFORMANCE" : ach!.kind,
    date: perf?.recordedOn ?? ach!.achievedOn,
    athleteId,
  });
}

export async function createSession(coachUserId: string, input: z.infer<typeof sessionSchema>, attendance: Record<string, string>) {
  const coach = await coachForUser(coachUserId);
  const mine = await db
    .select({ athleteId: schema.coachAssignments.athleteId })
    .from(schema.coachAssignments)
    .where(and(eq(schema.coachAssignments.coachId, coach.id), isNull(schema.coachAssignments.endDate)));
  const allowed = new Set(mine.map((m) => m.athleteId));
  const entries = Object.entries(attendance).filter(([, s]) => ["PRESENT", "ABSENT", "EXCUSED"].includes(s));
  if (!entries.length) throw new AppError("VALIDATION", "Mark attendance for at least one athlete");
  if (entries.some(([id]) => !allowed.has(id))) throw new AppError("FORBIDDEN", "You can only record attendance for your own athletes");

  return db.transaction(async (tx) => {
    const [s] = await tx.insert(schema.trainingSessions).values({ coachId: coach.id, ...input }).returning();
    await tx.insert(schema.sessionAttendance).values(entries.map(([athleteId, status]) => ({ sessionId: s.id, athleteId, status })));
    await audit({ actorId: coachUserId, action: "SESSION_ADDED", entity: "training_session", entityId: s.id, newValue: { athletes: entries.length } }, tx);
    return s;
  });
}

export async function createGoal(coachUserId: string, input: z.infer<typeof goalSchema>) {
  const coach = await coachForUser(coachUserId);
  await assertCoachOfAthlete(coach.id, input.athleteId);
  const athlete = await db.query.athletes.findFirst({ where: eq(schema.athletes.id, input.athleteId) });
  const metric = await db.query.sportMetrics.findFirst({ where: eq(schema.sportMetrics.id, input.metricId) });
  if (!metric || metric.sportId !== athlete!.sportId) throw new AppError("VALIDATION", "That metric isn't part of this athlete's sport");
  const lower = metric.direction === "LOWER_IS_BETTER";
  if (lower ? input.targetValue >= input.startValue : input.targetValue <= input.startValue) {
    throw new AppError("VALIDATION", lower ? `For ${metric.name}, lower is better: the target must be below the starting value` : `For ${metric.name}, higher is better: the target must be above the starting value`);
  }
  const [g] = await db
    .insert(schema.goals)
    .values({ athleteId: input.athleteId, metricId: input.metricId, setBy: coach.id, title: input.title, startValue: String(input.startValue), targetValue: String(input.targetValue), deadline: input.deadline })
    .returning();
  await db.insert(schema.notifications).values({ userId: athlete!.userId, type: "GOAL_ASSIGNED", title: `New goal: ${input.title}`, link: "/athlete/goals" });
  await audit({ actorId: coachUserId, action: "GOAL_SET", entity: "goal", entityId: g.id, newValue: { title: input.title } });
  return g;
}

export async function setGoalStatus(coachUserId: string, goalId: string, status: "ACHIEVED" | "CANCELLED" | "ACTIVE" | "MISSED") {
  const coach = await coachForUser(coachUserId);
  const g = await db.query.goals.findFirst({ where: eq(schema.goals.id, goalId) });
  if (!g) throw new AppError("NOT_FOUND", "Goal not found");
  await assertCoachOfAthlete(coach.id, g.athleteId);
  await db.update(schema.goals).set({ status }).where(eq(schema.goals.id, goalId));
  await audit({ actorId: coachUserId, action: "GOAL_STATUS", entity: "goal", entityId: goalId, oldValue: { status: g.status }, newValue: { status } });
}

export async function addFeedback(coachUserId: string, input: z.infer<typeof feedbackSchema>) {
  const coach = await coachForUser(coachUserId);
  await assertCoachOfAthlete(coach.id, input.athleteId);
  await db.insert(schema.coachFeedback).values({ athleteId: input.athleteId, coachId: coach.id, body: input.body });
  const athlete = await db.query.athletes.findFirst({ where: eq(schema.athletes.id, input.athleteId) });
  const me = await db.query.users.findFirst({ where: eq(schema.users.id, coachUserId) });
  await db.insert(schema.notifications).values({ userId: athlete!.userId, type: "FEEDBACK", title: `New feedback from ${me!.fullName}`, link: "/athlete/dashboard" });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt), ...(ids?.length ? [inArray(schema.notifications.id, ids)] : [])));
}
