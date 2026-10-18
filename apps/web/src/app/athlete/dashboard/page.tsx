import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { TrendChart, WeeklyBars } from "@/components/charts";
import { Icon } from "@/components/icons";
import { RecordList } from "@/components/records";
import { Empty, ProgressBar, Tile, fmtDate } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { athleteDashboard } from "@/server/services/dashboards";
import { achievementsFor } from "@/server/services/queries";
import { listRecords } from "@/server/services/records";

export const metadata = { title: "Dashboard" };

const DOT: Record<string, string> = { feedback: "var(--accent)", verified: "var(--ok)", rejected: "var(--bad)", submitted: "var(--wait)" };

export default async function AthleteDashboard() {
  const user = await requireUser("ATHLETE");
  const d = await athleteDashboard(user.id);
  if (!d) notFound();
  const { athlete, counts, attendance, metric, series, goals, activity } = d;
  const [pending, verified, achievements] = await Promise.all([
    listRecords(sql`a.id = ${athlete.id} and vr.status = 'PENDING'`, 5),
    listRecords(sql`a.id = ${athlete.id} and vr.status in ('VERIFIED', 'ANCHORED', 'INTEGRITY_WARNING')`, 5),
    achievementsFor([athlete.id]),
  ]);
  const first = user.fullName.split(" ")[0];
  const lower = metric?.direction === "LOWER_IS_BETTER";
  const best = series.length ? series.reduce((b, p) => (lower ? (p.value < b.value ? p : b) : p.value > b.value ? p : b)) : null;
  const primaryGoal = goals.find((g) => metric && g.metric_id === metric.id && g.status === "ACTIVE");
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const warnings = verified.filter((r) => r.status === "INTEGRITY_WARNING").length;

  return (
    <>
      <section className="welcome" aria-labelledby="welcome-h">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{fmtDate(new Date().toISOString().slice(0, 10), { weekday: "long", day: "numeric", month: "long" })} · {athlete.public_code}</p>
          <h1 id="welcome-h" style={{ marginTop: 4 }}>Welcome back, {first}</h1>
          <p className="meta">
            {[athlete.position ?? athlete.sport, athlete.team, athlete.coach ? `Coach ${athlete.coach}` : "No coach assigned yet"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="actions">
          <Link href="/athlete/performance#report" className="btn btn-primary"><Icon name="plus" size={18} />Report a result</Link>
          <Link href="/athlete/sharing" className="btn btn-ghost"><Icon name="qr" size={18} />Share profile</Link>
        </div>
      </section>

      {warnings ? (
        <div className="alert alert-error" role="alert">
          <Icon name="alert" size={18} />
          <div><strong>{warnings === 1 ? "One of your records no longer matches" : `${warnings} records no longer match`} the blockchain proof.</strong> Your academy admin has been notified. Open the record to see the details.</div>
        </div>
      ) : null}

      <section className="tiles" aria-label="Summary">
        <Tile
          href="/athlete/performance"
          label={metric ? `Best ${metric.name}` : "Personal best"}
          value={best && metric ? <>{best.value.toFixed(metric.decimals)}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}> {metric.unit}</span></> : "—"}
          sub={best ? fmtDate(best.date) : "No results yet"}
        />
        <Tile href="/athlete/verification" dark label="Verified records" value={counts.verified} sub={`${counts.anchored} anchored on-chain`} />
        <Tile href="/athlete/verification" label="Waiting for coach" value={counts.pending} sub={counts.pending ? "Pending review" : "Nothing waiting"} subTone={counts.pending ? "warn" : "good"} />
        <Tile href="/athlete/training" label="Attendance · 12 weeks" value={`${attendance.rate}%`} sub={`${attendance.present} of ${attendance.planned} sessions`} subTone={attendance.planned ? (attendance.rate >= 80 ? "good" : "warn") : undefined} />
        <Tile href="/athlete/goals" label="Active goals" value={activeGoals.length} sub={activeGoals.filter((g) => g.atRisk).length ? `${activeGoals.filter((g) => g.atRisk).length} at risk` : activeGoals.length ? "On track" : "None set"} subTone={activeGoals.some((g) => g.atRisk) ? "warn" : undefined} />
        <Tile href="/athlete/achievements" label="Achievements" value={counts.achievements} sub={achievements[0] ? achievements[0].title : undefined} />
      </section>

      <div className="grid-main">
        <div className="stack">
          <section className="card" aria-labelledby="trend-h">
            <div className="card-head">
              <h2 id="trend-h">{metric ? `${metric.name} trend` : "Performance"}</h2>
              <Link href="/athlete/performance" className="link">All results <Icon name="chevron" size={14} /></Link>
            </div>
            {metric ? (
              <TrendChart
                title={metric.name}
                points={series}
                unit={metric.unit}
                decimals={metric.decimals}
                lowerIsBetter={lower}
                goal={primaryGoal ? Number(primaryGoal.target) : undefined}
              />
            ) : (
              <Empty title="No results yet" icon="performance" action={<Link href="/athlete/performance#report" className="btn btn-ghost btn-sm">Report your first result</Link>}>
                Results you report, or your coach enters, appear here as a trend.
              </Empty>
            )}
          </section>

          <section className="card" aria-labelledby="att-h">
            <div className="card-head">
              <h2 id="att-h">Training attendance per week</h2>
              <Link href="/athlete/training" className="link">Sessions <Icon name="chevron" size={14} /></Link>
            </div>
            <WeeklyBars
              label={`Attended ${attendance.present} of ${attendance.planned} sessions over 12 weeks`}
              weeks={attendance.weeks.map((w) => ({ week: w.week, value: w.present, max: w.planned }))}
            />
            <p className="chart-note" style={{ marginTop: 8 }}>Orange: sessions attended. Dark track above: sessions you missed that week.</p>
          </section>

          <section className="card" aria-labelledby="goals-h">
            <div className="card-head">
              <h2 id="goals-h">Goal progress</h2>
              <Link href="/athlete/goals" className="link">All goals <Icon name="chevron" size={14} /></Link>
            </div>
            {activeGoals.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeGoals.map((g) => (
                  <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>{g.title}</span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {g.current.toFixed(g.decimals)} → {Number(g.target).toFixed(g.decimals)} {g.unit}
                      </span>
                    </div>
                    <ProgressBar value={g.progress} risk={g.atRisk} label={`${g.title}: ${g.progress}%`} />
                    <div style={{ fontSize: 12.5, color: g.atRisk ? "var(--wait)" : "var(--text-3)" }}>
                      {g.progress}% of the way · due {fmtDate(g.deadline, { day: "numeric", month: "short" })}
                      {g.daysLeft < 0 ? " · past deadline" : g.atRisk ? " · at risk" : ` · ${g.daysLeft} days left`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No active goals" icon="goals">Your coach sets goals from your athlete page.</Empty>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="pend-h">
            <div className="card-head">
              <h2 id="pend-h">Waiting for your coach</h2>
              {pending.length ? <span className="badge badge-pending">{counts.pending}</span> : null}
            </div>
            <RecordList records={pending} empty={<p className="muted" style={{ fontSize: 14 }}>Nothing waiting. Results you report go to your coach for review.</p>} />
          </section>

          <section className="card" aria-labelledby="ver-h">
            <div className="card-head">
              <h2 id="ver-h">Recently verified</h2>
              <Link href="/athlete/verification" className="link">All <Icon name="chevron" size={14} /></Link>
            </div>
            <RecordList records={verified} empty={<p className="muted" style={{ fontSize: 14 }}>No verified records yet.</p>} />
          </section>

          <section className="card" aria-labelledby="ach-h">
            <div className="card-head">
              <h2 id="ach-h">Achievements</h2>
              <Link href="/athlete/achievements" className="link">All <Icon name="chevron" size={14} /></Link>
            </div>
            {achievements.length ? (
              achievements.slice(0, 4).map((a) => (
                <div className="list-row" key={a.id}>
                  <span className="icon-chip accent"><Icon name="award" size={18} /></span>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{a.title}{a.result ? ` · ${a.result}` : ""}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{[a.event, fmtDate(a.date)].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>Medals, titles and milestones you add appear here.</p>
            )}
          </section>

          <section className="card" aria-labelledby="act-h">
            <div className="card-head"><h2 id="act-h">Recent activity</h2></div>
            {activity.length ? (
              activity.map((a, i) => (
                <div className="list-row" key={i}>
                  <span className="dot" style={{ background: DOT[a.kind] ?? "var(--text-3)" }} aria-hidden="true" />
                  <div className="grow">{a.text}</div>
                  <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(new Date(a.at).toISOString().slice(0, 10), { day: "numeric", month: "short" })}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>Coach feedback and verification decisions appear here.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
