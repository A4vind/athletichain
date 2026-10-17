import { sql } from "drizzle-orm";
import { PageHead } from "@/components/ui";
import { db } from "@/server/db";

export const metadata = { title: "Audit log" };

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;
  const rows = (await db.execute(sql`
    select to_char(l.at, 'YYYY-MM-DD HH24:MI:SS') as at, u.full_name as actor, u.role, l.action, l.entity, l.entity_id, l.old_value, l.new_value
    from audit_logs l left join users u on u.id = l.actor_id
    ${action ? sql`where l.action = ${action}` : sql``}
    order by l.at desc limit 300`)).rows as { at: string; actor: string | null; role: string | null; action: string; entity: string; entity_id: string | null; old_value: unknown; new_value: unknown }[];
  const actions = (await db.execute(sql`select action, count(*)::int as n from audit_logs group by 1 order by 2 desc`)).rows as { action: string; n: number }[];
  return (
    <>
      <PageHead kicker="Every important action, newest first" title="Audit log" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a href="/admin/audit-log" className={`badge ${!action ? "badge-anchored" : "badge-neutral"}`} style={{ textDecoration: "none" }}>All</a>
        {actions.map((a) => <a key={a.action} href={`?action=${a.action}`} className={`badge ${action === a.action ? "badge-anchored" : "badge-neutral"}`} style={{ textDecoration: "none" }}>{a.action.replaceAll("_", " ").toLowerCase()} · {a.n}</a>)}
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="data stack-sm">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Change</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="lead mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{r.at}</td>
                  <td data-label="Who">{r.actor ?? "System"}{r.role ? <span className="muted" style={{ fontSize: 12 }}> · {r.role.toLowerCase()}</span> : null}</td>
                  <td data-label="Action">{r.action.replaceAll("_", " ").toLowerCase()}</td>
                  <td data-label="Entity" className="muted">{r.entity}</td>
                  <td data-label="Change" className="mono" style={{ fontSize: 11.5, maxWidth: 360, wordBreak: "break-all" }}>
                    {r.old_value ? <span style={{ color: "var(--red)" }}>{JSON.stringify(r.old_value)} → </span> : null}
                    {r.new_value ? JSON.stringify(r.new_value) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
