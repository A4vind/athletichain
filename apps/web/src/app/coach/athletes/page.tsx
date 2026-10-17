import { Icon } from "@/components/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { coachDashboard } from "@/server/services/dashboards";

export const metadata = { title: "My athletes" };

export default async function CoachAthletes() {
  const user = await requireUser("COACH");
  const d = await coachDashboard(user.id);
  if (!d) notFound();
  return (
    <>
      <PageHead kicker={`${d.athletes.length} athletes · ${d.coach.academy ?? ""}`} title="My athletes" />
      <section className="card">
        {d.athletes.length ? (
          <div className="table-wrap">
            <table className="data stack-sm">
              <thead>
                <tr><th>Athlete</th><th>Sport</th><th>Team</th><th>Last activity</th><th className="num">Attendance (4 wks)</th><th className="num">Goals</th><th>Verification</th></tr>
              </thead>
              <tbody>
                {d.athletes.map((a) => (
                  <tr key={a.id}>
                    <td className="lead"><Link href={`/coach/athletes/${a.id}`} style={{ fontWeight: 600 }}>{a.name}</Link> <span className="muted mono" style={{ fontSize: 12 }}>{a.code}</span></td>
                    <td data-label="Sport">{a.sport}</td>
                    <td data-label="Team">{a.team ?? "—"}</td>
                    <td data-label="Last activity">{fmtDate(a.last_session, { day: "numeric", month: "short" })}</td>
                    <td data-label="Attendance (4 wks)" className="num">{a.planned ? Math.round((100 * a.attended) / a.planned) : 0}%</td>
                    <td data-label="Goals" className="num">{a.goals}</td>
                    <td data-label="Verification">
                      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        <span className="badge badge-verified"><Icon name="check" size={14} />{a.verified} verified</span>
                        {a.pending ? <span className="badge badge-pending"><Icon name="clock" size={14} />{a.pending} pending</span> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No athletes assigned yet">An admin assigns athletes to you from the Athletes page.</Empty>
        )}
      </section>
    </>
  );
}
