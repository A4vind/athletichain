/** Read-side queries shared by athlete, coach and admin pages. */
import "server-only";
import { goalProgress } from "@athletichain/canonical";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

async function rows<T>(q: ReturnType<typeof sql>) {
  return (await db.execute(q)).rows as T[];
}

export type MetricOption = { id: string; name: string; unit: string; direction: string; decimals: number; is_anchorable: boolean; sport_id: string; sport: string };

export async function metricsForSports(sportIds: string[]) {
  if (!sportIds.length) return [];
  return rows<MetricOption>(sql`
    select m.id, m.name, m.unit, m.direction, m.decimals, m.is_anchorable, m.sport_id, s.name as sport
    from sport_metrics m join sports s on s.id = m.sport_id
    where m.sport_id in (${sql.join(sportIds.map((id) => sql`${id}`), sql`, `)}) order by s.name, m.name`);
}

export type AthleteOption = { id: string; name: string; code: string; sport_id: string; sport: string; team_id: string | null; team: string | null; user_id: string };

export async function coachAthletes(coachId: string) {
  return rows<AthleteOption>(sql`
    select a.id, u.full_name as name, a.public_code as code, a.sport_id, s.name as sport, t.id as team_id, t.name as team, a.user_id
    from coach_assignments ca join athletes a on a.id = ca.athlete_id join users u on u.id = a.user_id join sports s on s.id = a.sport_id
    left join team_memberships tm on tm.athlete_id = a.id and tm.end_date is null left join teams t on t.id = tm.team_id
    where ca.coach_id = ${coachId} and ca.end_date is null order by u.full_name`);
}

export type PerformanceRow = {
  id: string; athlete: string; athlete_id: string; metric: string; value: string; unit: string; decimals: number; direction: string;
  date: string; event: string | null; source: string; status: string | null; public_id: string | null; entered_by: string; anchorable: boolean;
};

export async function performanceFor(athleteIds: string[], limit = 100) {
  if (!athleteIds.length) return [];
  return rows<PerformanceRow>(sql`
    select pr.id, u.full_name as athlete, pr.athlete_id, m.name as metric, pr.value::text as value, m.unit, m.decimals, m.direction,
      to_char(pr.recorded_on, 'YYYY-MM-DD') as date, pr.event_name as event, pr.source, vr.status, vr.public_id,
      eu.full_name as entered_by, m.is_anchorable as anchorable
    from performance_records pr join sport_metrics m on m.id = pr.metric_id join athletes a on a.id = pr.athlete_id
    join users u on u.id = a.user_id join users eu on eu.id = pr.entered_by
    left join verifiable_records vr on vr.performance_record_id = pr.id
    where pr.athlete_id in (${sql.join(athleteIds.map((id) => sql`${id}`), sql`, `)})
    order by pr.recorded_on desc, pr.created_at desc limit ${limit}`);
}

export type SessionRow = { id: string; date: string; type: string; duration: number; intensity: string; team: string | null; notes: string | null; exercises: string | null; present: number; total: number; status?: string; observation?: string | null };

export async function sessionsForCoach(coachId: string, limit = 30) {
  return rows<SessionRow>(sql`
    select ts.id, to_char(ts.session_date, 'YYYY-MM-DD') as date, ts.type, ts.duration_min as duration, ts.intensity, t.name as team, ts.notes, ts.exercises,
      count(*) filter (where sa.status = 'PRESENT')::int as present, count(sa.*)::int as total
    from training_sessions ts left join teams t on t.id = ts.team_id left join session_attendance sa on sa.session_id = ts.id
    where ts.coach_id = ${coachId} group by ts.id, t.name order by ts.session_date desc, ts.created_at desc limit ${limit}`);
}

export async function sessionsForAthlete(athleteId: string, limit = 60) {
  return rows<SessionRow>(sql`
    select ts.id, to_char(ts.session_date, 'YYYY-MM-DD') as date, ts.type, ts.duration_min as duration, ts.intensity, t.name as team, ts.notes, ts.exercises,
      0 as present, 0 as total, sa.status, sa.observation
    from session_attendance sa join training_sessions ts on ts.id = sa.session_id left join teams t on t.id = ts.team_id
    where sa.athlete_id = ${athleteId} order by ts.session_date desc limit ${limit}`);
}

export type GoalRow = {
  id: string; athlete: string; athlete_id: string; title: string; metric: string; unit: string; decimals: number; direction: string;
  start: number; target: number; current: number; progress: number; deadline: string; status: string; daysLeft: number; atRisk: boolean;
};

export async function goalsFor(athleteIds: string[]): Promise<GoalRow[]> {
  if (!athleteIds.length) return [];
  const raw = await rows<{ id: string; athlete: string; athlete_id: string; title: string; metric: string; unit: string; decimals: number; direction: string; start: string; target: string; current: string | null; deadline: string; status: string }>(sql`
    select g.id, u.full_name as athlete, g.athlete_id, g.title, m.name as metric, m.unit, m.decimals, m.direction,
      g.start_value::text as start, g.target_value::text as target, to_char(g.deadline, 'YYYY-MM-DD') as deadline, g.status,
      (select pr.value::text from performance_records pr where pr.athlete_id = g.athlete_id and pr.metric_id = g.metric_id order by pr.recorded_on desc, pr.created_at desc limit 1) as current
    from goals g join sport_metrics m on m.id = g.metric_id join athletes a on a.id = g.athlete_id join users u on u.id = a.user_id
    where g.athlete_id in (${sql.join(athleteIds.map((id) => sql`${id}`), sql`, `)})
    order by (g.status = 'ACTIVE') desc, g.deadline`);
  return raw.map((g) => {
    const start = Number(g.start), target = Number(g.target);
    const current = g.current === null ? start : Number(g.current);
    const progress = goalProgress(start, current, target);
    const daysLeft = Math.ceil((Date.parse(g.deadline) - Date.now()) / 86_400_000);
    return { ...g, start, target, current, progress, daysLeft, atRisk: g.status === "ACTIVE" && progress < 60 && daysLeft < 21 };
  });
}

export type AchievementRow = { id: string; athlete: string; kind: string; title: string; event: string | null; result: string | null; date: string; status: string | null; public_id: string | null; entered_by: string };

export async function achievementsFor(athleteIds: string[]) {
  if (!athleteIds.length) return [];
  return rows<AchievementRow>(sql`
    select ach.id, u.full_name as athlete, ach.kind, ach.title, ach.event_name as event, ach.result, to_char(ach.achieved_on, 'YYYY-MM-DD') as date,
      vr.status, vr.public_id, eu.full_name as entered_by
    from achievements ach join athletes a on a.id = ach.athlete_id join users u on u.id = a.user_id join users eu on eu.id = ach.entered_by
    left join verifiable_records vr on vr.achievement_id = ach.id
    where ach.athlete_id in (${sql.join(athleteIds.map((id) => sql`${id}`), sql`, `)}) order by ach.achieved_on desc`);
}

export async function feedbackFor(athleteId: string) {
  return rows<{ id: string; coach: string; body: string; at: string }>(sql`
    select f.id, u.full_name as coach, f.body, to_char(f.created_at, 'YYYY-MM-DD') as at
    from coach_feedback f join coaches c on c.id = f.coach_id join users u on u.id = c.user_id
    where f.athlete_id = ${athleteId} order by f.created_at desc`);
}

export async function teamsForAcademy(academyId: string | null) {
  return rows<{ id: string; name: string }>(sql`select id, name from teams where academy_id is not distinct from ${academyId} order by name`);
}

/** Simple, explainable insight from verified-or-coach-entered results only. */
export function trendInsight(points: { value: number }[], lowerIsBetter: boolean, unit: string, decimals: number) {
  if (points.length < 3) return null;
  const n = points.length;
  const xs = points.map((_, i) => i), ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const better = lowerIsBetter ? slope < 0 : slope > 0;
  const flat = Math.abs(slope) < Math.abs(my) * 0.002;
  const last3 = ys.slice(-3);
  const steady = lowerIsBetter ? last3[0] >= last3[1] && last3[1] >= last3[2] : last3[0] <= last3[1] && last3[1] <= last3[2];
  return {
    trend: flat ? "Stable" : better ? "Improving" : "Declining",
    change: `${ys[0].toFixed(decimals)} → ${ys[n - 1].toFixed(decimals)} ${unit}`,
    perResult: `${slope >= 0 ? "+" : ""}${slope.toFixed(decimals + 1)} ${unit} per result`,
    observation: steady ? `Improved in each of the last three recorded results.` : `Results vary between sessions; look at the last three for the current form.`,
  };
}
