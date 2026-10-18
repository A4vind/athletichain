import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { WeeklyBars } from "@/components/charts";
import { Icon } from "@/components/icons";
import { RecordList } from "@/components/records";
import { Empty, Tile, fmtDate } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { chainStatus, registry } from "@/server/blockchain/chain";
import { db } from "@/server/db";
import { coachDashboard } from "@/server/services/dashboards";
import { listRecords } from "@/server/services/records";

export const metadata = { title: "Coach dashboard" };

export default async function CoachDashboard() {
  const user = await requireUser("COACH");
  const d = await coachDashboard(user.id);
  if (!d) notFound();
  const { coach, athletes, queue, weekly, pendingTotal, active, totals } = d;
  const avgRate = weekly.length ? Math.round(weekly.reduce((n, w) => n + (w.rate ?? 0), 0) / weekly.length) : 0;

  const [recent, status, evidence, rejected] = await Promise.all([
    listRecords(sql`vr.verified_by = ${coach.id}`, 5),
    chainStatus(),
    db.execute(sql`
      select vr.public_id as id, count(e.id)::int as files
      from verification_requests r join verifiable_records vr on vr.id = r.record_id
      left join evidence_files e on e.record_id = vr.id
      where r.assigned_coach = ${coach.id} and r.decision is null group by vr.public_id`),
    db.execute(sql`select count(*)::int as n from verification_requests where assigned_coach = ${coach.id} and decision = 'REJECTED'`),
  ]);
  const files = new Map((evidence.rows as { id: string; files: number }[]).map((r) => [r.id, r.files]));
  let registered: boolean | null = null;
  if (status.ok && coach.wallet_address) {
    try {
      const v = await registry().verifiers(coach.wallet_address);
      registered = v.exists && v.activeUntil === 0n;
    } catch {
      registered = null;
    }
  }
  const anchoredByMe = recent.filter((r) => r.txHash).length;

  return (
    <>
      <section className="welcome" aria-labelledby="welcome-h">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">Coach {coach.public_code}{coach.academy ? ` · ${coach.academy}` : ""}{coach.sport ? ` · ${coach.sport}` : ""}</p>
          <h1 id="welcome-h" style={{ marginTop: 4 }}>Welcome back, {user.fullName.split(" ")[0]}</h1>
          <p className="meta">
            {pendingTotal ? `${pendingTotal} ${pendingTotal === 1 ? "record is" : "records are"} waiting for your review.` : "Your verification queue is clear."}
          </p>
        </div>
        <div className="actions">
          <Link href="/coach/verifications" className="btn btn-primary"><Icon name="clipboard" size={18} />{pendingTotal ? `Review ${pendingTotal} pending` : "Open queue"}</Link>
          <Link href="/coach/training" className="btn btn-ghost"><Icon name="plus" size={18} />Log a session</Link>
        </div>
      </section>

      {!coach.wallet_address ? (
        <div className="alert alert-warn">
          <Icon name="wallet" size={18} />
          <div>No wallet linked yet. Records you approve are coach verified but not anchored until you <Link href="/coach/blockchain">link a wallet</Link>.</div>
        </div>
      ) : null}

      <section className="tiles" aria-label="Summary">
        <Tile href="/coach/verifications" label="Pending review" value={pendingTotal} subTone={pendingTotal ? "warn" : "good"} sub={pendingTotal ? "Waiting for you" : "All clear"} />
        <Tile href="/coach/blockchain" dark label="Records you verified" value={totals.verified} sub={`${rejected.rows[0] ? (rejected.rows[0] as { n: number }).n : 0} rejected`} />
        <Tile href="/coach/athletes" label="Athletes" value={athletes.length} sub={`${active} active in 14 days`} subTone={athletes.length - active ? "warn" : "good"} />
        <Tile href="/coach/training" label="Sessions · 4 weeks" value={totals.sessions28} sub={`${avgRate}% average attendance`} />
        <Tile href="/coach/goals" label="Active goals" value={totals.goals} />
        <Tile
          href="/coach/blockchain"
          label="Verifier wallet"
          small
          value={coach.wallet_address ? <span className="mono">{`${coach.wallet_address.slice(0, 6)}…${coach.wallet_address.slice(-4)}`}</span> : "Not linked"}
          sub={!status.ok ? "Chain unreachable" : registered === null ? "Status unknown" : registered ? "Registered on-chain" : "Not registered"}
          subTone={registered ? "good" : "warn"}
        />
      </section>

      <div className="grid-main">
        <div className="stack">
          <section className="card" aria-labelledby="queue-h">
            <div className="card-head">
              <h2 id="queue-h">Verification queue</h2>
              <Link href="/coach/verifications" className="link">Review all <Icon name="chevron" size={14} /></Link>
            </div>
            {queue.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {queue.map((q) => (
                  <Link key={q.id} href="/coach/verifications" className="list-link">
                    <span className="icon-chip wait"><Icon name="clock" size={18} /></span>
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{q.athlete} · {q.record}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {q.kind} · {fmtDate(q.date)} · {q.submitted_by === q.athlete ? "self-reported" : `entered by ${q.submitted_by}`} · {files.get(q.id) ? `${files.get(q.id)} evidence file${files.get(q.id) === 1 ? "" : "s"}` : "no evidence"}
                      </div>
                    </div>
                    <Icon name="chevron" size={16} className="chev" />
                  </Link>
                ))}
                {pendingTotal > queue.length ? <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>And {pendingTotal - queue.length} more, oldest first.</p> : null}
              </div>
            ) : (
              <Empty title="Nothing to review" icon="check">New submissions from your athletes appear here.</Empty>
            )}
          </section>

          <section className="card" aria-labelledby="ath-h">
            <div className="card-head">
              <h2 id="ath-h">My athletes</h2>
              <Link href="/coach/athletes" className="link">All <Icon name="chevron" size={14} /></Link>
            </div>
            {athletes.length ? (
              <div className="table-wrap">
                <table className="data stack-sm">
                  <thead>
                    <tr><th>Athlete</th><th>Team</th><th>Last session</th><th className="num">Attendance · 4 wks</th><th className="num">Active goals</th><th>Records</th></tr>
                  </thead>
                  <tbody>
                    {athletes.map((a) => (
                      <tr key={a.id}>
                        <td className="lead"><Link href={`/coach/athletes/${a.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>{a.name}</Link> <span className="muted mono" style={{ fontSize: 12 }}>{a.code}</span></td>
                        <td data-label="Team">{a.team ?? "—"}</td>
                        <td data-label="Last session">{fmtDate(a.last_session, { day: "numeric", month: "short" })}</td>
                        <td data-label="Attendance" className="num">{a.planned ? Math.round((100 * a.attended) / a.planned) : 0}%</td>
                        <td data-label="Active goals" className="num">{a.goals}</td>
                        <td data-label="Records">
                          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                            <span className="badge badge-verified"><Icon name="check" size={14} />{a.verified}</span>
                            {a.pending ? <span className="badge badge-pending"><Icon name="clock" size={14} />{a.pending}</span> : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No athletes assigned yet" icon="users">An academy admin assigns athletes to you.</Empty>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="chain-h">
            <div className="card-head">
              <h2 id="chain-h">Anchoring status</h2>
              <Link href="/coach/blockchain" className="link">Details <Icon name="chevron" size={14} /></Link>
            </div>
            <div className="list-row">
              <span className={`icon-chip ${status.ok ? "chain" : "bad"}`}><Icon name="chain" size={18} /></span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{status.ok ? (status.network === "sepolia" ? "Ethereum Sepolia" : "Local Hardhat chain") : "Chain unreachable"}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{status.ok ? `Chain id ${status.chainId} · block ${status.block}` : status.error}</div>
              </div>
            </div>
            <div className="list-row">
              <span className={`icon-chip ${registered ? "ok" : "wait"}`}><Icon name="wallet" size={18} /></span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{registered ? "Your wallet can sign verifications" : coach.wallet_address ? "Wallet not registered as a verifier" : "No wallet linked"}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{coach.wallet_address ? <span className="mono break">{coach.wallet_address}</span> : "Link one on the Blockchain page."}</div>
              </div>
            </div>
            <div className="list-row">
              <span className="icon-chip chain"><Icon name="hexagon" size={18} /></span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{anchoredByMe} of your last {recent.length} verifications anchored</div>
                <div className="muted" style={{ fontSize: 12.5 }}>Each anchor is a mined transaction signed by your wallet.</div>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="hist-h">
            <div className="card-head">
              <h2 id="hist-h">Verification history</h2>
              <Link href="/coach/blockchain" className="link">All <Icon name="chevron" size={14} /></Link>
            </div>
            <RecordList records={recent} showAthlete empty={<p className="muted" style={{ fontSize: 14 }}>Records you approve appear here.</p>} />
          </section>

          <section className="card" aria-labelledby="sess-h">
            <div className="card-head"><h2 id="sess-h">Sessions run per week</h2></div>
            <WeeklyBars
              label={`Sessions run per week over 12 weeks; average attendance ${avgRate}%`}
              weeks={weekly.map((w) => ({ week: w.week, value: w.sessions, max: w.sessions }))}
            />
            <p className="chart-note" style={{ marginTop: 8 }}>Average attendance across your squad: {avgRate}%.</p>
          </section>
        </div>
      </div>
    </>
  );
}
