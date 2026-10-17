import "server-only";
import { requireUser } from "@/server/auth/current-user";
import { coachForUser } from "./access";
import { coachAthletes, metricsForSports, teamsForAcademy } from "./queries";

export async function coachContext() {
  const user = await requireUser("COACH");
  const coach = await coachForUser(user.id);
  const athletes = await coachAthletes(coach.id);
  const sportIds = [...new Set([...athletes.map((a) => a.sport_id), ...(coach.sportId ? [coach.sportId] : [])])];
  const [metrics, teams] = await Promise.all([metricsForSports(sportIds), teamsForAcademy(coach.academyId)]);
  return { user, coach, athletes, metrics, teams };
}
