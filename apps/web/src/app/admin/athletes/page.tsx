import { Icon } from "@/components/icons";
import { sql } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { PageHead } from "@/components/ui";
import { db } from "@/server/db";
import { ageOn } from "@/server/validators/auth";
import { consentAction, transferAction } from "../actions";

export const metadata = { title: "Athletes" };

export default async function AdminAthletes() {
  const athletes = (
    await db.execute(sql`
      select a.id, u.full_name as name, a.public_code as code, s.name as sport, a.sport_id, to_char(a.date_of_birth, 'YYYY-MM-DD') as dob,
        a.guardian_name, a.guardian_consent_at is not null as consent, ca.coach_id, cu.full_name as coach, tm.team_id, t.name as team,
        (select count(*)::int from coach_assignments x where x.athlete_id = a.id) as assignments
      from athletes a join users u on u.id = a.user_id join sports s on s.id = a.sport_id
      left join coach_assignments ca on ca.athlete_id = a.id and ca.end_date is null
      left join coaches c on c.id = ca.coach_id left join users cu on cu.id = c.user_id
      left join team_memberships tm on tm.athlete_id = a.id and tm.end_date is null left join teams t on t.id = tm.team_id
      order by s.name, u.full_name`)
  ).rows as { id: string; name: string; code: string; sport: string; sport_id: string; dob: string; guardian_name: string | null; consent: boolean; coach_id: string | null; coach: string | null; team_id: string | null; team: string | null; assignments: number }[];
  const coaches = (await db.execute(sql`
    select c.id, u.full_name as name, c.sport_id, a.name as academy from coaches c join users u on u.id = c.user_id
    left join academies a on a.id = c.academy_id where u.status = 'ACTIVE' order by u.full_name`)).rows as { id: string; name: string; sport_id: string | null; academy: string | null }[];
  const teams = (await db.execute(sql`select t.id, t.name, t.sport_id, a.name as academy from teams t join academies a on a.id = t.academy_id order by a.name, t.name`)).rows as { id: string; name: string; sport_id: string; academy: string }[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead kicker={`${athletes.length} athletes`} title="Athletes" />
      <p className="muted" style={{ margin: 0 }}>Changing a coach or team ends the current assignment and starts a new one, so the athlete&apos;s full history (and who verified what) is kept.</p>
      <section className="card">
        <div className="table-wrap">
          <table className="data stack-sm">
            <thead><tr><th>Athlete</th><th>Sport</th><th>Guardian consent</th><th style={{ minWidth: 420 }}>Coach and team</th></tr></thead>
            <tbody>
              {athletes.map((a) => {
                const minor = ageOn(a.dob, today) < 18;
                return (
                  <tr key={a.id}>
                    <td className="lead"><strong>{a.name}</strong><div className="muted mono" style={{ fontSize: 12 }}>{a.code} · age {ageOn(a.dob, today)}{a.assignments > 1 ? ` · ${a.assignments - 1} past coach` : ""}</div></td>
                    <td data-label="Sport">{a.sport}</td>
                    <td data-label="Guardian consent">
                      {!minor ? <span className="muted">Not needed</span> : a.consent ? <span className="badge badge-verified"><Icon name="check" size={14} />Recorded</span> : (
                        <ActionForm action={consentAction} submitLabel={`Record consent${a.guardian_name ? ` (${a.guardian_name})` : ""}`} submitClass="btn btn-ghost btn-sm" inlineSubmit>
                          <input type="hidden" name="athleteId" value={a.id} />
                        </ActionForm>
                      )}
                    </td>
                    <td data-label="Coach and team">
                      <ActionForm action={transferAction} submitLabel="Save" submitClass="btn btn-ghost btn-sm" inlineSubmit keepOnSuccess style={{ gap: 8 }}>
                        <input type="hidden" name="athleteId" value={a.id} />
                        <select name="coachId" className="input" defaultValue={a.coach_id ?? ""} aria-label={`Coach for ${a.name}`} style={{ width: 170, minHeight: 38, padding: "6px 8px" }}>
                          <option value="" disabled>Coach…</option>
                          {coaches.filter((c) => !c.sport_id || c.sport_id === a.sport_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select name="teamId" className="input" defaultValue={a.team_id ?? ""} aria-label={`Team for ${a.name}`} style={{ width: 170, minHeight: 38, padding: "6px 8px" }}>
                          <option value="" disabled>Team…</option>
                          {teams.filter((t) => t.sport_id === a.sport_id).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.academy}</option>)}
                        </select>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
