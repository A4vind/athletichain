import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";

export async function athleteForUser(userId: string) {
  const a = await db.query.athletes.findFirst({ where: eq(schema.athletes.userId, userId) });
  if (!a) throw new AppError("NOT_FOUND", "Athlete profile not found");
  return a;
}

export async function coachForUser(userId: string) {
  const c = await db.query.coaches.findFirst({ where: eq(schema.coaches.userId, userId) });
  if (!c) throw new AppError("NOT_FOUND", "Coach profile not found");
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (u?.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Your coach account is not approved yet");
  return c;
}

/** The coach currently assigned to the athlete (end_date is null), or throws. */
export async function assertCoachOfAthlete(coachId: string, athleteId: string) {
  const row = await db.query.coachAssignments.findFirst({
    where: and(eq(schema.coachAssignments.coachId, coachId), eq(schema.coachAssignments.athleteId, athleteId), isNull(schema.coachAssignments.endDate)),
  });
  if (!row) throw new AppError("FORBIDDEN", "This athlete is not assigned to you");
}

export async function activeCoachOf(athleteId: string) {
  const row = await db.query.coachAssignments.findFirst({
    where: and(eq(schema.coachAssignments.athleteId, athleteId), isNull(schema.coachAssignments.endDate)),
  });
  return row?.coachId ?? null;
}
