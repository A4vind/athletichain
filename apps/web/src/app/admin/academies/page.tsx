import { sql } from "drizzle-orm";
import { ActionForm, F, Row } from "@/components/action-form";
import { PageHead } from "@/components/ui";
import { db } from "@/server/db";
import { academyAction, teamAction } from "../actions";

export const metadata = { title: "Academies & teams" };

export default async function Academies() {
  const academies = (await db.execute(sql`
    select a.id, a.name, a.city,
      (select count(*)::int from coaches c where c.academy_id = a.id) as coaches
    from academies a order by a.name`)).rows as { id: string; name: string; city: string | null; coaches: number }[];
  const teams = (await db.execute(sql`
    select t.id, t.name, t.academy_id, s.name as sport,
      (select count(*)::int from team_memberships tm where tm.team_id = t.id and tm.end_date is null) as members
    from teams t join sports s on s.id = t.sport_id order by t.name`)).rows as { id: string; name: string; academy_id: string; sport: string; members: number }[];
  const sports = (await db.execute(sql`select id, name from sports where is_active order by name`)).rows as { id: string; name: string }[];

  return (
    <>
      <PageHead kicker={`${academies.length} academies · ${teams.length} teams`} title="Academies & teams" />
      <div className="grid-2">
        {academies.map((a) => (
          <section className="card" key={a.id}>
            <div className="card-head"><h2>{a.name}</h2><span className="muted" style={{ fontSize: 13 }}>{a.city ?? ""} · {a.coaches} coaches</span></div>
            {teams.filter((t) => t.academy_id === a.id).map((t) => (
              <div className="list-row" key={t.id}><span style={{ flexGrow: 1 }}><strong>{t.name}</strong> <span className="muted">· {t.sport}</span></span><span className="muted">{t.members} athletes</span></div>
            ))}
            <div style={{ marginTop: 12 }}>
              <ActionForm action={teamAction} submitLabel="Add team" submitClass="btn btn-ghost btn-sm" inlineSubmit>
                <input type="hidden" name="academyId" value={a.id} />
                <F label="New team" name={`tn-${a.id}`}><input id={`tn-${a.id}`} name="name" className="input" placeholder="e.g. U-17 Squad" /></F>
                <F label="Sport" name={`ts-${a.id}`}>
                  <select id={`ts-${a.id}`} name="sportId" className="input">{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                </F>
              </ActionForm>
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="card-head"><h2>Add an academy</h2></div>
        <ActionForm action={academyAction} submitLabel="Create academy">
          <Row>
            <F label="Name" name="name"><input id="name" name="name" className="input" /></F>
            <F label="City" name="city"><input id="city" name="city" className="input" /></F>
          </Row>
        </ActionForm>
      </section>
    </>
  );
}
