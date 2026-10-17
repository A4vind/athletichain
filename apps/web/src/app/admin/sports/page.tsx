import { sql } from "drizzle-orm";
import { ActionForm, F, Row } from "@/components/action-form";
import { PageHead } from "@/components/ui";
import { db } from "@/server/db";
import { metricAction } from "../actions";

export const metadata = { title: "Sports & metrics" };

export default async function Sports() {
  const sports = (await db.execute(sql`select id, name, is_fully_built from sports order by is_fully_built desc, name`)).rows as { id: string; name: string; is_fully_built: boolean }[];
  const metrics = (await db.execute(sql`
    select m.id, m.sport_id, m.code, m.name, m.unit, m.direction, m.decimals, m.is_anchorable,
      (select count(*)::int from performance_records pr where pr.metric_id = m.id) as results
    from sport_metrics m order by m.name`)).rows as { id: string; sport_id: string; code: string; name: string; unit: string; direction: string; decimals: number; is_anchorable: boolean; results: number }[];
  return (
    <>
      <PageHead kicker="Flexible metric system" title="Sports & metrics" />
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
        Each metric says which way is better, so charts and goal progress work for times (lower) and distances or runs (higher). Anchorable metrics (★) can be verified and put on-chain; others are training metrics.
      </p>
      <div className="grid-2">
        {sports.map((s) => (
          <section className="card" key={s.id}>
            <div className="card-head"><h2>{s.name}</h2>{s.is_fully_built ? <span className="badge badge-verified">fully built</span> : <span className="badge badge-neutral">metrics defined</span>}</div>
            <table className="data stack-sm">
              <thead><tr><th>Metric</th><th>Unit</th><th>Better</th><th className="num">Results</th></tr></thead>
              <tbody>
                {metrics.filter((m) => m.sport_id === s.id).map((m) => (
                  <tr key={m.id}>
                    <td className="lead">{m.is_anchorable ? "★ " : ""}{m.name} <span className="muted mono" style={{ fontSize: 11.5 }}>{m.code}</span></td>
                    <td data-label="Unit">{m.unit}</td>
                    <td data-label="Better">{m.direction === "LOWER_IS_BETTER" ? "↓ lower" : "↑ higher"}</td>
                    <td data-label="Results" className="num">{m.results}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="card-head"><h2>Add a metric</h2></div>
        <ActionForm action={metricAction} submitLabel="Add metric">
          <Row>
            <F label="Sport" name="sportId"><select id="sportId" name="sportId" className="input">{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></F>
            <F label="Name" name="name"><input id="name" name="name" className="input" placeholder="e.g. Triple jump" /></F>
            <F label="Code" name="code" hint="lowercase, e.g. triple_jump"><input id="code" name="code" className="input" /></F>
          </Row>
          <Row>
            <F label="Unit" name="unit"><input id="unit" name="unit" className="input" placeholder="m" /></F>
            <F label="Better when" name="direction"><select id="direction" name="direction" className="input"><option value="HIGHER_IS_BETTER">Higher</option><option value="LOWER_IS_BETTER">Lower</option></select></F>
            <F label="Decimals" name="decimals"><input id="decimals" name="decimals" defaultValue="2" inputMode="numeric" className="input" /></F>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 44, alignSelf: "flex-end" }}><input type="checkbox" name="isAnchorable" style={{ width: 20, height: 20 }} /> Can be verified and anchored</label>
          </Row>
        </ActionForm>
      </section>
    </>
  );
}
