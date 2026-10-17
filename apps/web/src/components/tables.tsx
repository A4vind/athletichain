import Link from "next/link";
import type { AchievementRow, GoalRow, PerformanceRow, SessionRow } from "@/server/services/queries";
import { ActionForm, type ActionState } from "./action-form";
import { statusTrust } from "./records";
import { Empty, ProgressBar, TrustBadge, fmtDate } from "./ui";
import type { TrustLevel } from "@/server/services/dashboards";

function perfTrust(r: { source: string; status: string | null }): TrustLevel {
  if (r.status && r.status !== "DRAFT") return statusTrust(r.status as never);
  return r.source === "COACH_ENTERED" ? "COACH_VERIFIED" : "SELF_REPORTED";
}

function RecordLink({ publicId }: { publicId: string | null }) {
  return publicId ? <Link href={`/records/${publicId}`} className="mono" style={{ fontSize: 12 }}>{publicId}</Link> : null;
}

export function PerformanceTable({ rows, showAthlete, submitAction }: { rows: PerformanceRow[]; showAthlete?: boolean; submitAction?: (p: ActionState, f: FormData) => Promise<ActionState> }) {
  if (!rows.length) return <Empty title="No results yet" />;
  return (
    <div className="table-wrap">
      <table className="data stack-sm">
        <thead>
          <tr>{showAthlete ? <th>Athlete</th> : null}<th>Metric</th><th className="num">Value</th><th>Date</th><th>Event</th><th>Entered by</th><th>Trust</th><th><span className="sr-only">Record</span></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {showAthlete ? <td className="lead"><strong>{r.athlete}</strong></td> : null}
              <td data-label="Metric" className={showAthlete ? undefined : "lead"}>{r.metric}</td>
              <td className="num" data-label="Value"><strong>{Number(r.value).toFixed(r.decimals)}</strong> {r.unit}</td>
              <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              <td data-label="Event">{r.event ?? "—"}</td>
              <td data-label="Entered by">{r.entered_by}</td>
              <td data-label="Status"><TrustBadge level={perfTrust(r)} /></td>
              <td data-label="" style={{ textAlign: "right" }}>
                {submitAction && r.anchorable && (!r.status || r.status === "DRAFT" || r.status === "REJECTED") && r.source === "SELF_REPORTED" ? (
                  <ActionForm action={submitAction} submitLabel="Submit for verification" submitClass="btn btn-ghost btn-sm" inlineSubmit>
                    <input type="hidden" name="publicId" value={r.public_id ?? ""} />
                    <input type="hidden" name="performanceId" value={r.id} />
                  </ActionForm>
                ) : (
                  <RecordLink publicId={r.public_id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GoalsTable({ rows, showAthlete, statusAction }: { rows: GoalRow[]; showAthlete?: boolean; statusAction?: (p: ActionState, f: FormData) => Promise<ActionState> }) {
  if (!rows.length) return <Empty title="No goals yet" />;
  return (
    <div className="table-wrap">
      <table className="data stack-sm">
        <thead>
          <tr>{showAthlete ? <th>Athlete</th> : null}<th>Goal</th><th className="num">Current</th><th className="num">Target</th><th style={{ minWidth: 160 }}>Progress · deadline</th><th>Status</th>{statusAction ? <th><span className="sr-only">Update</span></th> : null}</tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id}>
              {showAthlete ? <td className="lead"><strong>{g.athlete}</strong></td> : null}
              <td className={showAthlete ? "wide" : "wide lead"} data-label="Goal">{g.title}<div className="muted" style={{ fontSize: 11.5 }}>{g.metric} · {g.direction === "LOWER_IS_BETTER" ? "↓ lower is better" : "↑ higher is better"}</div></td>
              <td className="num" data-label="Current">{g.current.toFixed(g.decimals)} {g.unit}</td>
              <td className="num" data-label="Target">{g.target.toFixed(g.decimals)} {g.unit}</td>
              <td data-label="" className="full">
                <ProgressBar value={g.progress} risk={g.atRisk} label={`${g.title}: ${g.progress}%`} />
                <div style={{ fontSize: 12, marginTop: 4, color: g.atRisk ? "var(--amber)" : "var(--muted)" }}>
                  {g.progress}% · {fmtDate(g.deadline, { day: "numeric", month: "short" })}{g.status === "ACTIVE" && g.daysLeft < 0 ? " · past deadline" : g.atRisk ? " · at risk" : ""}
                </div>
              </td>
              <td data-label="Status"><span className={`badge ${g.status === "ACHIEVED" ? "badge-verified" : g.status === "ACTIVE" ? "badge-neutral" : "badge-rejected"}`}>{g.status.toLowerCase()}</span></td>
              {statusAction ? (
                <td data-label="">
                  {g.status === "ACTIVE" ? (
                    <ActionForm action={statusAction} submitLabel={g.progress >= 100 ? "Mark achieved" : "Close goal"} submitClass="btn btn-ghost btn-sm" inlineSubmit>
                      <input type="hidden" name="goalId" value={g.id} />
                      <input type="hidden" name="status" value={g.progress >= 100 ? "ACHIEVED" : g.daysLeft < 0 ? "MISSED" : "CANCELLED"} />
                    </ActionForm>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AchievementsTable({ rows, showAthlete, submitAction }: { rows: AchievementRow[]; showAthlete?: boolean; submitAction?: (p: ActionState, f: FormData) => Promise<ActionState> }) {
  if (!rows.length) return <Empty title="No achievements yet" />;
  return (
    <div className="table-wrap">
      <table className="data stack-sm">
        <thead>
          <tr>{showAthlete ? <th>Athlete</th> : null}<th>Achievement</th><th>Result</th><th>Date</th><th>Trust</th><th><span className="sr-only">Record</span></th></tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              {showAthlete ? <td className="lead"><strong>{a.athlete}</strong></td> : null}
              <td className={showAthlete ? "wide" : "wide lead"} data-label="Achievement"><strong>{a.title}</strong>{a.kind === "MILESTONE" ? <span className="badge badge-neutral" style={{ marginLeft: 8 }}>milestone</span> : null}<div className="muted" style={{ fontSize: 12 }}>{a.event ?? ""}</div></td>
              <td data-label="Result">{a.result ?? "—"}</td>
              <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
              <td data-label="Status"><TrustBadge level={a.status && a.status !== "DRAFT" ? statusTrust(a.status as never) : "SELF_REPORTED"} /></td>
              <td data-label="" style={{ textAlign: "right" }}>
                {submitAction && (a.status === "DRAFT" || a.status === "REJECTED") && a.public_id ? (
                  <ActionForm action={submitAction} submitLabel="Submit for verification" submitClass="btn btn-ghost btn-sm" inlineSubmit>
                    <input type="hidden" name="publicId" value={a.public_id} />
                  </ActionForm>
                ) : (
                  <RecordLink publicId={a.public_id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SessionsTable({ rows, perAthlete }: { rows: SessionRow[]; perAthlete?: boolean }) {
  if (!rows.length) return <Empty title="No training sessions yet" />;
  return (
    <div className="table-wrap">
      <table className="data stack-sm">
        <thead>
          <tr><th>Date</th><th>Type</th><th className="num">Minutes</th><th>Intensity</th>{perAthlete ? <th>Attendance</th> : <th className="num">Present</th>}<th>Notes</th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="lead" style={{ whiteSpace: "nowrap" }}><strong>{fmtDate(s.date)}</strong></td>
              <td data-label="Session">{s.type}{s.exercises ? <div className="muted" style={{ fontSize: 12 }}>{s.exercises}</div> : null}</td>
              <td className="num" data-label="Minutes">{s.duration}</td>
              <td data-label="Intensity">{s.intensity.charAt(0) + s.intensity.slice(1).toLowerCase()}</td>
              {perAthlete ? (
                <td data-label="Attendance"><span className={`badge ${s.status === "PRESENT" ? "badge-verified" : s.status === "EXCUSED" ? "badge-pending" : "badge-rejected"}`}>{(s.status ?? "").toLowerCase()}</span></td>
              ) : (
                <td className="num" data-label="Present">{s.present} / {s.total}</td>
              )}
              <td data-label="Notes">{[s.notes, s.observation].filter(Boolean).join(" · ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
