import Link from "next/link";
import { sql } from "drizzle-orm";
import { ActionForm, F } from "@/components/action-form";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { db } from "@/server/db";
import { resolveDisputeAction } from "../actions";

export const metadata = { title: "Disputes" };

export default async function Disputes() {
  const rows = (await db.execute(sql`
    select d.id, d.status, d.reason, d.resolution, to_char(d.created_at, 'YYYY-MM-DD') as raised, vr.public_id, vr.status as record_status, u.full_name as raised_by,
      (select r.reason from verification_requests r where r.record_id = vr.id and r.decision = 'REJECTED' order by r.decided_at desc limit 1) as rejection
    from disputes d join verifiable_records vr on vr.id = d.record_id join users u on u.id = d.raised_by
    order by (d.status = 'OPEN') desc, d.created_at desc`)).rows as { id: string; status: string; reason: string; resolution: string | null; raised: string; public_id: string; record_status: string; raised_by: string; rejection: string | null }[];
  return (
    <>
      <PageHead kicker={`${rows.filter((r) => r.status === "OPEN").length} open`} title="Disputes" />
      {rows.length ? rows.map((d) => (
        <section className="card" key={d.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2><Link href={`/records/${d.public_id}`} className="mono">{d.public_id}</Link> · raised by {d.raised_by} on {fmtDate(d.raised)}</h2>
            <span className={`badge ${d.status === "OPEN" ? "badge-pending" : d.status === "UPHELD" ? "badge-verified" : "badge-neutral"}`}>{d.status.toLowerCase()}</span>
          </div>
          {d.rejection ? <div style={{ fontSize: 14 }}>Coach&apos;s rejection: &ldquo;{d.rejection}&rdquo;</div> : null}
          <div style={{ fontSize: 14 }}>Athlete&apos;s dispute: &ldquo;{d.reason}&rdquo;</div>
          {d.status === "OPEN" ? (
            <ActionForm action={resolveDisputeAction} submitLabel="Resolve">
              <input type="hidden" name="disputeId" value={d.id} />
              <F label="Decision" name={`u-${d.id}`}>
                <select id={`u-${d.id}`} name="uphold" className="input"><option value="1">Uphold — send back to the coach for a fresh review</option><option value="0">Dismiss — the rejection stands</option></select>
              </F>
              <F label="Note to the athlete" name={`r-${d.id}`}><input id={`r-${d.id}`} name="resolution" className="input" /></F>
            </ActionForm>
          ) : <div className="muted" style={{ fontSize: 14 }}>Resolution: {d.resolution}</div>}
        </section>
      )) : <Empty title="No disputes" />}
    </>
  );
}
