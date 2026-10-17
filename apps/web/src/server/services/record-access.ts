import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { getRecordByPublicId } from "./records";

/** Who may see a record: its athlete, a coach who coaches them or was asked to review it, and admins. */
export async function assertCanView(u: { id: string; role: string }, publicId: string) {
  const r = await getRecordByPublicId(publicId);
  if (u.role === "ADMIN") return r;
  if (u.role === "ATHLETE") {
    if (r.athleteUserId !== u.id) throw new AppError("FORBIDDEN", "Not your record");
    return r;
  }
  const res = await db.execute(sql`
    select 1 from coaches c where c.user_id = ${u.id} and (
      exists (select 1 from coach_assignments ca where ca.coach_id = c.id and ca.athlete_id = ${r.athleteId})
      or exists (select 1 from verification_requests vq where vq.assigned_coach = c.id and vq.record_id = ${r.id}))`);
  if (!res.rows.length) throw new AppError("FORBIDDEN", "This record belongs to an athlete you don't coach");
  return r;
}
