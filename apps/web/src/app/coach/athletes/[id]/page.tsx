import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { TrendChart, WeeklyBars } from "@/components/charts";
import { AchievementForm, FeedbackForm, GoalForm, PerformanceForm } from "@/components/forms";
import { RecordsTable } from "@/components/records";
import { AchievementsTable, GoalsTable, PerformanceTable, SessionsTable } from "@/components/tables";
import { Empty, PageHead, Tile, fmtDate } from "@/components/ui";
import { athleteDashboard } from "@/server/services/dashboards";
import { coachContext } from "@/server/services/coach-context";
import { achievementsFor, feedbackFor, goalsFor, performanceFor, sessionsForAthlete, trendInsight } from "@/server/services/queries";
import { listRecords } from "@/server/services/records";
import { addAchievementAction, addGoalAction, addPerformanceAction, feedbackAction, goalStatusAction } from "../../actions";

const TABS = ["overview", "training", "performance", "goals", "achievements", "feedback", "verification", "blockchain"] as const;
type Tab = (typeof TABS)[number];

export default async function AthleteDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab = (TABS.includes((await searchParams).tab as Tab) ? (await searchParams).tab : "overview") as Tab;
  const { athletes, metrics } = await coachContext();
  const athlete = athletes.find((a) => a.id === id);
  if (!athlete) notFound();
  const sportMetrics = metrics.filter((m) => m.sport_id === athlete.sport_id);

  return (
    <>
      <PageHead kicker={`${athlete.code} · ${athlete.sport} · ${athlete.team ?? "No team"}`} title={athlete.name} />
      <nav aria-label="Athlete sections" className="tabs">
        {TABS.map((t) => (
          <Link key={t} href={`?tab=${t}`} aria-current={t === tab ? "page" : undefined} scroll={false}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </nav>
      <TabBody tab={tab} athleteId={athlete.id} userId={athlete.user_id} metrics={sportMetrics} />
    </>
  );
}

async function TabBody({ tab, athleteId, userId, metrics }: { tab: Tab; athleteId: string; userId: string; metrics: Awaited<ReturnType<typeof coachContext>>["metrics"] }) {
  if (tab === "overview") {
    const d = (await athleteDashboard(userId))!;
    const insight = d.metric ? trendInsight(d.series.filter((p) => p.trust === "COACH_VERIFIED" || p.trust === "ANCHORED"), d.metric.direction === "LOWER_IS_BETTER", d.metric.unit, d.metric.decimals) : null;
    const prev = d.series.at(-2), last = d.series.at(-1);
    return (
      <>
        <section className="tiles">
          <Tile label="Sessions (12 wks)" value={`${d.attendance.present} / ${d.attendance.planned}`} sub={`${d.attendance.rate}% attendance`} subTone={d.attendance.rate >= 80 ? "good" : "warn"} />
          <Tile label="Previous → current" value={prev && last && d.metric ? `${prev.value.toFixed(d.metric.decimals)} → ${last.value.toFixed(d.metric.decimals)}` : "—"} sub={d.metric?.name} />
          <Tile label="Achievements" value={d.counts.achievements} />
          <Tile dark label="Verified records" value={d.counts.verified} sub={`${d.counts.anchored} anchored · ${d.counts.pending} pending`} />
        </section>
        <div className="grid-2">
          <section className="card">
            <div className="card-head"><h2>{d.metric?.name ?? "Performance"}</h2></div>
            {d.metric ? <TrendChart title={d.metric.name} points={d.series} unit={d.metric.unit} decimals={d.metric.decimals} lowerIsBetter={d.metric.direction === "LOWER_IS_BETTER"} /> : <Empty title="No results yet" />}
          </section>
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card-head" style={{ marginBottom: 0 }}><h2>Training consistency</h2></div>
            <WeeklyBars label="Sessions attended per week" weeks={d.attendance.weeks.map((w) => ({ week: w.week, value: w.present, max: w.planned }))} />
            {insight ? (
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, fontSize: 14 }}>
                <div className="eyebrow" style={{ color: "var(--muted)", marginBottom: 6 }}>Insight · rule-based</div>
                Trend <strong>{insight.trend.toLowerCase()}</strong> ({insight.change}, {insight.perResult}). Consistency <strong>{d.attendance.rate >= 85 ? "high" : d.attendance.rate >= 70 ? "moderate" : "low"}</strong> ({d.attendance.rate}%). {insight.observation}
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>An observation from past results, not a prediction or medical advice.</div>
              </div>
            ) : null}
          </section>
        </div>
      </>
    );
  }
  if (tab === "training") return <section className="card"><SessionsTable rows={await sessionsForAthlete(athleteId)} perAthlete /></section>;
  if (tab === "performance")
    return (
      <>
        <section className="card"><div className="card-head"><h2>Add a result</h2></div><PerformanceForm action={addPerformanceAction} fixedAthlete={athleteId} metrics={metrics} submitLabel="Send to another coach for verification (you can't verify your own entry)" /></section>
        <section className="card"><div className="card-head"><h2>All results</h2></div><PerformanceTable rows={await performanceFor([athleteId])} /></section>
      </>
    );
  if (tab === "goals")
    return (
      <>
        <section className="card"><div className="card-head"><h2>Set a goal</h2></div><GoalForm action={addGoalAction} fixedAthlete={athleteId} metrics={metrics} /></section>
        <section className="card"><GoalsTable rows={await goalsFor([athleteId])} statusAction={goalStatusAction} /></section>
      </>
    );
  if (tab === "achievements")
    return (
      <>
        <section className="card"><div className="card-head"><h2>Record an achievement</h2></div><AchievementForm action={addAchievementAction} fixedAthlete={athleteId} submitLabel="Send to another coach for verification" /></section>
        <section className="card"><AchievementsTable rows={await achievementsFor([athleteId])} /></section>
      </>
    );
  if (tab === "feedback") {
    const fb = await feedbackFor(athleteId);
    return (
      <>
        <section className="card"><div className="card-head"><h2>Write feedback</h2></div><FeedbackForm action={feedbackAction} athleteId={athleteId} /></section>
        <section className="card">
          {fb.length ? fb.map((f) => (
            <div className="list-row" key={f.id}>
              <span className="dot" style={{ background: "var(--orange)" }} aria-hidden="true" />
              <div style={{ flexGrow: 1 }}>&ldquo;{f.body}&rdquo; <span className="muted">— {f.coach}</span></div>
              <span className="muted" style={{ fontSize: 12 }}>{fmtDate(f.at, { day: "numeric", month: "short" })}</span>
            </div>
          )) : <Empty title="No feedback yet" />}
        </section>
      </>
    );
  }
  const records = await listRecords(tab === "blockchain" ? sql`a.id = ${athleteId} and ba.tx_hash is not null` : sql`a.id = ${athleteId} and vr.status <> 'DRAFT'`);
  return <section className="card">{records.length ? <RecordsTable records={records} linkBase="/records" /> : <Empty title={tab === "blockchain" ? "Nothing anchored yet" : "No records sent for verification yet"} />}</section>;
}
