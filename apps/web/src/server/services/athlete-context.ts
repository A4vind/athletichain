import "server-only";
import { requireUser } from "@/server/auth/current-user";
import { athleteForUser } from "./access";
import { metricsForSports } from "./queries";

export async function athleteContext() {
  const user = await requireUser("ATHLETE");
  const athlete = await athleteForUser(user.id);
  const metrics = await metricsForSports([athlete.sportId]);
  return { user, athlete, metrics };
}
