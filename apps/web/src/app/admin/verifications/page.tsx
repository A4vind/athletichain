import Link from "next/link";
import { sql } from "drizzle-orm";
import { PageHead } from "@/components/ui";
import { db } from "@/server/db";

export const metadata = { title: "Verifications" };

export default async function AdminVerifications() {
  const rows = (await db.execute(sql`
    select vr.public_id, vr.status, au.full_name as athlete, su.full_name as submitted_by, cu.full_name as coach, r.decision, r.reason,
      to_char(r.created_at, 'YYYY-MM-DD') as submitted, to_char(r.decided_at, 'YYYY-MM-DD') as decided
    from verification_requests r join verifiable_records vr on vr.id = r.record_id
    left join performance_records pr on pr.id = vr.performance_record_id left join achievements ach on ach.id = vr.achievement_id
    join athletes a on a.id = coalesce(pr.athlete_id, ach.athlete_id) join users au on au.id = a.user_id
    join users su on su.id = r.submitted_by join coaches c on c.id = r.assigned_coach join users cu on cu.id = c.user_id
    order by r.created_at desc limit 300`)).rows as { public_id: string; status: string; athlete: string; submitted_by: string; coach: string; decision: string | null; reason: string | null; submitted: string; decided: string | null }[];
  const waiting = rows.filter((r) => !r.decision).length;
  return (
    <>
      <PageHead kicker={`${rows.length} requests · ${waiting} waiting`} title="Verifications" />
      <section className="card">
        <div className="table-wrap">
          <table className="data stack-sm">
            <thead><tr><th>Record</th><th>Athlete</th><th>Submitted by</th><th>Reviewer</th><th>Submitted</th><th>Decision</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="lead"><Link href={`/records/${r.public_id}`} className="mono" style={{ fontSize: 12.5 }}>{r.public_id}</Link></td>
                  <td data-label="Athlete">{r.athlete}</td>
                  <td data-label="Submitted by">{r.submitted_by}</td>
                  <td data-label="Reviewer">{r.coach}</td>
                  <td data-label="Submitted" style={{ whiteSpace: "nowrap" }}>{r.submitted}</td>
                  <td data-label="Decision">{r.decision ? <span className={`badge ${r.decision === "APPROVED" ? "badge-verified" : "badge-rejected"}`}>{r.decision.toLowerCase()} {r.decided}</span> : <span className="badge badge-pending">waiting</span>}</td>
                  <td data-label="Reason">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
