import Link from "next/link";
import type { RecordView } from "@/server/services/records";
import { Icon } from "./icons";
import { TrustBadge, fmtDate } from "./ui";
import type { TrustLevel } from "@/server/services/dashboards";

export function statusTrust(status: RecordView["status"]): TrustLevel {
  switch (status) {
    case "ANCHORED":
      return "ANCHORED";
    case "VERIFIED":
      return "COACH_VERIFIED";
    case "PENDING":
      return "PENDING";
    case "REJECTED":
      return "REJECTED";
    case "INTEGRITY_WARNING":
      return "INTEGRITY_WARNING";
    default:
      return "SELF_REPORTED";
  }
}

export const shortHash = (h: string | null | undefined) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—");

/** One table for verified records everywhere: athlete, coach, admin. */
export function RecordsTable({ records, showAthlete, linkBase, actions }: {
  records: RecordView[];
  showAthlete?: boolean;
  linkBase?: string;
  actions?: (r: RecordView) => React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="data stack-sm">
        <thead>
          <tr>
            <th>Record</th>
            {showAthlete ? <th>Athlete</th> : null}
            <th>Date</th>
            <th>Verified by</th>
            <th>Status</th>
            <th>Transaction</th>
            {actions ? <th><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td className="wide lead">
                <strong>{r.title}</strong> · {r.display}
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {linkBase ? <Link href={`${linkBase}/${r.publicId}`}>{r.publicId}</Link> : r.publicId}
                  {r.event ? <span style={{ fontFamily: "var(--sans)", color: "var(--text-3)" }}> · {r.event}</span> : null}
                </div>
              </td>
              {showAthlete ? <td data-label="Athlete">{r.athleteName}</td> : null}
              <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              <td data-label="Verified by">{r.verifierName ?? "—"}</td>
              <td data-label="Status"><TrustBadge level={statusTrust(r.status)} /></td>
              <td data-label="Transaction" className="mono" style={{ fontSize: 12 }}>{r.txHash ? shortHash(r.txHash) : "—"}</td>
              {actions ? <td data-label="" style={{ textAlign: "right" }}>{actions(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact, tappable list of records for dashboards and phones. */
export function RecordList({ records, showAthlete, empty }: { records: RecordView[]; showAthlete?: boolean; empty?: React.ReactNode }) {
  if (!records.length) return <>{empty ?? <p className="muted" style={{ fontSize: 14 }}>Nothing here yet.</p>}</>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {records.map((r) => (
        <Link key={r.id} href={`/records/${r.publicId}`} className="list-link">
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {showAthlete ? `${r.athleteName} · ` : ""}{r.title} <span style={{ color: "var(--text)" }}>{r.display}</span>
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {fmtDate(r.date)}{r.verifierName ? ` · ${r.verifierName}` : ""}{r.event ? ` · ${r.event}` : ""}
            </div>
          </div>
          <TrustBadge level={statusTrust(r.status)} short />
          <Icon name="chevron" size={16} className="chev" />
        </Link>
      ))}
    </div>
  );
}
