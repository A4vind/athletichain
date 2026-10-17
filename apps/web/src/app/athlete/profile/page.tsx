import Link from "next/link";
import { sql } from "drizzle-orm";
import { RecordsTable } from "@/components/records";
import { Empty, PageHead, Tile, fmtDate, initials } from "@/components/ui";
import { db } from "@/server/db";
import { athleteContext } from "@/server/services/athlete-context";
import { athleteDashboard } from "@/server/services/dashboards";
import { listRecords } from "@/server/services/records";

export const metadata = { title: "Profile" };

export default async function AthleteProfile() {
  const { user, athlete } = await athleteContext();
  const d = (await athleteDashboard(user.id))!;
  const bests = (
    await db.execute(sql`
      select m.name, m.unit, m.decimals,
        (case when m.direction = 'LOWER_IS_BETTER' then min(pr.value) else max(pr.value) end)::text as best,
        count(*)::int as results
      from performance_records pr join sport_metrics m on m.id = pr.metric_id
      where pr.athlete_id = ${athlete.id} group by m.id order by m.name`)
  ).rows as { name: string; unit: string; decimals: number; best: string; results: number }[];
  const records = await listRecords(sql`a.id = ${athlete.id} and vr.status in ('VERIFIED','ANCHORED','INTEGRITY_WARNING')`);
  const since = (await db.execute(sql`select to_char(min(start_date), 'YYYY-MM-DD') as d from coach_assignments where athlete_id = ${athlete.id}`)).rows[0] as { d: string | null };

  return (
    <>
      <PageHead kicker={athlete.publicCode} title="Profile">
        <Link href="/athlete/sharing" className="btn btn-primary">Share verified profile</Link>
      </PageHead>
      <section className="card" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 24 }} aria-hidden="true">{initials(user.fullName)}</div>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div className="display" style={{ fontSize: "clamp(26px, 5vw, 34px)" }}>{user.fullName}</div>
          <div className="muted">{d.athlete.sport} · {athlete.position ?? "—"} · {d.athlete.team ?? "No team"} · {d.athlete.academy ?? ""}</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Coach: <strong>{d.athlete.coach ?? "Unassigned"}</strong> · training with AthletiChain academies since {fmtDate(since.d, { month: "long", year: "numeric" })}</div>
          {athlete.bio ? <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>{athlete.bio}</p> : null}
        </div>
      </section>

      <section className="tiles">
        {bests.map((b) => <Tile key={b.name} label={`Best · ${b.name}`} value={`${Number(b.best).toFixed(b.decimals)} ${b.unit}`} sub={`${b.results} results`} />)}
        <Tile label="Training (12 wks)" value={`${d.attendance.present} sessions`} sub={`${d.attendance.rate}% attendance`} />
        <Tile dark label="Verified records" value={d.counts.verified} sub={`${d.counts.anchored} blockchain anchored`} />
      </section>

      <section className="card" aria-labelledby="vr-h">
        <div className="card-head"><h2 id="vr-h">Verified athlete records</h2><Link href="/athlete/sharing" style={{ fontSize: 14 }}>Create QR / share link →</Link></div>
        {records.length ? <RecordsTable records={records} linkBase="/records" /> : <Empty title="No verified records yet">Submit a result with evidence and your coach can verify it.</Empty>}
      </section>
    </>
  );
}
