import "server-only";
import { goalProgress } from "@athletichain/canonical";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}
async function one<T>(query: ReturnType<typeof sql>): Promise<T | undefined> {
  return (await rows<T>(query))[0];
}

export type TrustLevel = "SELF_REPORTED" | "COACH_VERIFIED" | "ANCHORED" | "PENDING" | "REJECTED" | "INTEGRITY_WARNING";

function trustOf(source: string, status: string | null): TrustLevel {
  if (status === "ANCHORED") return "ANCHORED";
  if (status === "VERIFIED") return "COACH_VERIFIED";
  if (status === "PENDING") return "PENDING";
  if (status === "REJECTED") return "REJECTED";
  if (status === "INTEGRITY_WARNING") return "INTEGRITY_WARNING";
  return source === "COACH_ENTERED" ? "COACH_VERIFIED" : "SELF_REPORTED";
}

// --------------------------------------------------------------------- athlete

export async function athleteDashboard(userId: string) {
  const athlete = await one<{
    id: string; public_code: string; position: string | null; sport: string; sport_code: string;
    coach: string | null; team: string | null; academy: string | null; coach_since: string | null;
  }>(sql`
    select a.id, a.public_code, a.position, s.name as sport, s.code as sport_code,
           cu.full_name as coach, ca.start_date as coach_since, t.name as team, ac.name as academy
    from athletes a
    join sports s on s.id = a.sport_id
    left join coach_assignments ca on ca.athlete_id = a.id and ca.end_date is null
    left join coaches c on c.id = ca.coach_id
    left join users cu on cu.id = c.user_id
    left join team_memberships tm on tm.athlete_id = a.id and tm.end_date is null
    left join teams t on t.id = tm.team_id
    left join academies ac on ac.id = t.academy_id
    where a.user_id = ${userId}`);
  if (!athlete) return null;

  const attendance = await rows<{ week: string; present: number; planned: number }>(sql`
    select to_char(date_trunc('week', ts.session_date), 'YYYY-MM-DD') as week,
           count(*) filter (where sa.status = 'PRESENT')::int as present,
           count(*)::int as planned
    from session_attendance sa join training_sessions ts on ts.id = sa.session_id
    where sa.athlete_id = ${athlete.id} and ts.session_date > current_date - 84
    group by 1 order by 1`);
  const present = attendance.reduce((n, w) => n + w.present, 0);
  const planned = attendance.reduce((n, w) => n + w.planned, 0);

  const counts = await one<{ achievements: number; verified: number; anchored: number; pending: number }>(sql`
    with mine as (
      select vr.status from verifiable_records vr
      left join performance_records pr on pr.id = vr.performance_record_id
      left join achievements ach on ach.id = vr.achievement_id
      where coalesce(pr.athlete_id, ach.athlete_id) = ${athlete.id})
    select (select count(*)::int from achievements where athlete_id = ${athlete.id}) as achievements,
           count(*) filter (where status in ('VERIFIED','ANCHORED'))::int as verified,
           count(*) filter (where status = 'ANCHORED')::int as anchored,
           count(*) filter (where status = 'PENDING')::int as pending
    from mine`);

  // Primary metric = the one with the most results.
  const metric = await one<{ id: string; name: string; unit: string; direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER"; decimals: number }>(sql`
    select m.id, m.name, m.unit, m.direction, m.decimals
    from performance_records pr join sport_metrics m on m.id = pr.metric_id
    where pr.athlete_id = ${athlete.id}
    group by m.id order by count(*) desc, m.name limit 1`);
  const series = metric
    ? (
        await rows<{ date: string; value: string; source: string; status: string | null; event: string | null }>(sql`
          select to_char(pr.recorded_on, 'YYYY-MM-DD') as date, pr.value, pr.source, vr.status, pr.event_name as event
          from performance_records pr left join verifiable_records vr on vr.performance_record_id = pr.id
          where pr.athlete_id = ${athlete.id} and pr.metric_id = ${metric.id}
          order by pr.recorded_on`)
      ).map((r) => ({ date: r.date, value: Number(r.value), event: r.event, trust: trustOf(r.source, r.status) }))
    : [];

  const goals = (
    await rows<{ id: string; metric_id: string; title: string; start: string; target: string; deadline: string; status: string; unit: string; decimals: number; direction: string; current: string | null }>(sql`
      select g.id, g.metric_id, g.title, g.start_value as start, g.target_value as target, to_char(g.deadline, 'YYYY-MM-DD') as deadline,
             g.status, m.unit, m.decimals, m.direction,
             (select pr.value from performance_records pr where pr.athlete_id = g.athlete_id and pr.metric_id = g.metric_id
              order by pr.recorded_on desc limit 1) as current
      from goals g join sport_metrics m on m.id = g.metric_id
      where g.athlete_id = ${athlete.id} order by g.deadline`)
  ).map((g) => {
    const current = g.current === null ? Number(g.start) : Number(g.current);
    const progress = goalProgress(Number(g.start), current, Number(g.target));
    const daysLeft = Math.ceil((Date.parse(g.deadline) - Date.now()) / 86_400_000);
    const atRisk = g.status === "ACTIVE" && progress < 60 && daysLeft < 21;
    return { ...g, current, progress, daysLeft, atRisk, lowerIsBetter: g.direction === "LOWER_IS_BETTER" };
  });

  const activity = await rows<{ at: string; kind: string; text: string }>(sql`
    (select f.created_at as at, 'feedback' as kind, 'Feedback from ' || u.full_name || ': "' || f.body || '"' as text
       from coach_feedback f join coaches c on c.id = f.coach_id join users u on u.id = c.user_id
      where f.athlete_id = ${athlete.id})
    union all
    (select coalesce(r.decided_at, r.created_at), case when r.decision = 'APPROVED' then 'verified' when r.decision = 'REJECTED' then 'rejected' else 'submitted' end,
            case when r.decision = 'APPROVED' then 'Coach verified ' else case when r.decision = 'REJECTED' then 'Rejected: ' else 'Submitted for verification: ' end end
            || coalesce(m.name || ' · ' || trim(to_char(pr.value, 'FM9999990.00')) || ' ' || m.unit, ach.title)
       from verification_requests r join verifiable_records vr on vr.id = r.record_id
       left join performance_records pr on pr.id = vr.performance_record_id
       left join sport_metrics m on m.id = pr.metric_id
       left join achievements ach on ach.id = vr.achievement_id
      where coalesce(pr.athlete_id, ach.athlete_id) = ${athlete.id})
    order by at desc limit 6`);

  return {
    athlete,
    attendance: { weeks: attendance, present, planned, rate: planned ? Math.round((present / planned) * 100) : 0 },
    counts: counts ?? { achievements: 0, verified: 0, anchored: 0, pending: 0 },
    metric,
    series,
    goals,
    activity,
  };
}

// ----------------------------------------------------------------------- coach

export async function coachDashboard(userId: string) {
  const coach = await one<{ id: string; public_code: string; academy: string | null; sport: string | null; approved_at: string | null; wallet_address: string | null }>(sql`
    select c.id, c.public_code, ac.name as academy, s.name as sport, c.approved_at, c.wallet_address
    from coaches c left join academies ac on ac.id = c.academy_id left join sports s on s.id = c.sport_id
    where c.user_id = ${userId}`);
  if (!coach) return null;

  const athletes = await rows<{
    id: string; name: string; code: string; sport: string; team: string | null; last_session: string | null;
    attended: number; planned: number; goals: number; pending: number; verified: number;
  }>(sql`
    select a.id, u.full_name as name, a.public_code as code, s.name as sport, t.name as team,
      (select to_char(max(ts.session_date), 'YYYY-MM-DD') from session_attendance sa join training_sessions ts on ts.id = sa.session_id
        where sa.athlete_id = a.id and sa.status = 'PRESENT') as last_session,
      (select count(*)::int from session_attendance sa join training_sessions ts on ts.id = sa.session_id
        where sa.athlete_id = a.id and sa.status = 'PRESENT' and ts.session_date > current_date - 28) as attended,
      (select count(*)::int from session_attendance sa join training_sessions ts on ts.id = sa.session_id
        where sa.athlete_id = a.id and ts.session_date > current_date - 28) as planned,
      (select count(*)::int from goals g where g.athlete_id = a.id and g.status = 'ACTIVE') as goals,
      (select count(*)::int from verification_requests r join verifiable_records vr on vr.id = r.record_id
        where r.assigned_coach = ${coach.id} and r.decision is null and vr.status = 'PENDING'
          and exists (select 1 from performance_records pr where pr.id = vr.performance_record_id and pr.athlete_id = a.id
                      union all select 1 from achievements ach where ach.id = vr.achievement_id and ach.athlete_id = a.id)) as pending,
      (select count(*)::int from verifiable_records vr
        left join performance_records pr on pr.id = vr.performance_record_id left join achievements ach on ach.id = vr.achievement_id
        where coalesce(pr.athlete_id, ach.athlete_id) = a.id and vr.status in ('VERIFIED','ANCHORED')) as verified
    from coach_assignments ca
    join athletes a on a.id = ca.athlete_id join users u on u.id = a.user_id join sports s on s.id = a.sport_id
    left join team_memberships tm on tm.athlete_id = a.id and tm.end_date is null left join teams t on t.id = tm.team_id
    where ca.coach_id = ${coach.id} and ca.end_date is null
    order by u.full_name`);

  const queue = await rows<{ id: string; athlete: string; record: string; date: string; submitted_by: string; kind: string }>(sql`
    select vr.public_id as id, u.full_name as athlete,
           coalesce(m.name || ' · ' || trim(to_char(pr.value, 'FM9999990.00')) || ' ' || m.unit, ach.title || ' · ' || coalesce(ach.result, '')) as record,
           to_char(coalesce(pr.recorded_on, ach.achieved_on), 'YYYY-MM-DD') as date, su.full_name as submitted_by,
           case when pr.id is not null then 'Performance' when ach.kind = 'MILESTONE' then 'Milestone' else 'Achievement' end as kind
    from verification_requests r join verifiable_records vr on vr.id = r.record_id
    left join performance_records pr on pr.id = vr.performance_record_id left join sport_metrics m on m.id = pr.metric_id
    left join achievements ach on ach.id = vr.achievement_id
    join athletes a on a.id = coalesce(pr.athlete_id, ach.athlete_id) join users u on u.id = a.user_id
    join users su on su.id = r.submitted_by
    where r.assigned_coach = ${coach.id} and r.decision is null and vr.status = 'PENDING'
    order by r.created_at limit 6`);

  const weekly = await rows<{ week: string; sessions: number; rate: number }>(sql`
    select to_char(date_trunc('week', ts.session_date), 'YYYY-MM-DD') as week, count(distinct ts.id)::int as sessions,
           round(100.0 * count(*) filter (where sa.status = 'PRESENT') / nullif(count(sa.*), 0))::int as rate
    from training_sessions ts left join session_attendance sa on sa.session_id = ts.id
    where ts.coach_id = ${coach.id} and ts.session_date > current_date - 84
    group by 1 order by 1`);

  const totals = await one<{ sessions28: number; verified: number; goals: number }>(sql`
    select (select count(*)::int from training_sessions where coach_id = ${coach.id} and session_date > current_date - 28) as sessions28,
           (select count(*)::int from verifiable_records where verified_by = ${coach.id} and status in ('VERIFIED','ANCHORED')) as verified,
           (select count(*)::int from goals where set_by = ${coach.id} and status = 'ACTIVE') as goals`);

  const pendingTotal = (await one<{ n: number }>(sql`
    select count(*)::int as n from verification_requests r join verifiable_records vr on vr.id = r.record_id
    where r.assigned_coach = ${coach.id} and r.decision is null and vr.status = 'PENDING'`))?.n ?? 0;

  const active = athletes.filter((a) => a.last_session && Date.now() - Date.parse(a.last_session) < 14 * 86_400_000).length;
  return { coach, athletes, queue, weekly, pendingTotal, active, totals: totals ?? { sessions28: 0, verified: 0, goals: 0 } };
}

// ----------------------------------------------------------------------- admin

export async function adminDashboard() {
  const stats = (await one<Record<string, number>>(sql`
    select (select count(*)::int from athletes) as athletes,
           (select count(*)::int from coaches c join users u on u.id = c.user_id where u.status = 'ACTIVE') as coaches,
           (select count(*)::int from users where role = 'COACH' and status = 'PENDING_APPROVAL') as pending_coaches,
           (select count(*)::int from teams) as teams,
           (select count(*)::int from academies) as academies,
           (select count(*)::int from verifiable_records where status in ('VERIFIED','ANCHORED')) as verified,
           (select count(*)::int from verifiable_records where status = 'PENDING') as pending,
           (select count(*)::int from blockchain_anchors where status = 'CONFIRMED') as anchored,
           (select count(*)::int from verifiable_records where status = 'INTEGRITY_WARNING') as warnings,
           (select count(*)::int from users where last_login_at > now() - interval '30 days') as active_users`))!;

  const pendingCoaches = await rows<{ user_id: string; name: string; email: string; code: string; academy: string | null; sport: string | null; created_at: string }>(sql`
    select u.id as user_id, u.full_name as name, u.email, c.public_code as code, ac.name as academy, s.name as sport,
           to_char(u.created_at, 'YYYY-MM-DD') as created_at
    from users u join coaches c on c.user_id = u.id
    left join academies ac on ac.id = c.academy_id left join sports s on s.id = c.sport_id
    where u.status = 'PENDING_APPROVAL' order by u.created_at`);

  const users = await rows<{ id: string; name: string; email: string; role: string; status: string; last_login: string | null }>(sql`
    select id, full_name as name, email, role, status, to_char(last_login_at, 'YYYY-MM-DD HH24:MI') as last_login
    from users order by role, full_name`);

  const recent = await rows<{ at: string; actor: string | null; action: string; entity: string }>(sql`
    select to_char(l.at, 'YYYY-MM-DD HH24:MI') as at, u.full_name as actor, l.action, l.entity
    from audit_logs l left join users u on u.id = l.actor_id order by l.at desc limit 8`);

  const bySport = await rows<{ sport: string; athletes: number; built: boolean }>(sql`
    select s.name as sport, count(a.id)::int as athletes, s.is_fully_built as built
    from sports s left join athletes a on a.sport_id = s.id group by s.id order by count(a.id) desc, s.name`);

  return { stats, pendingCoaches, users, recent, bySport };
}
