import { ActionForm, F, Row, type ActionState } from "./action-form";
import { EvidenceInput } from "./evidence-input";
import type { AthleteOption, MetricOption } from "@/server/services/queries";

type Act = (prev: ActionState, form: FormData) => Promise<ActionState>;
const today = () => new Date().toISOString().slice(0, 10);

function AthleteSelect({ athletes, fixed }: { athletes?: AthleteOption[]; fixed?: string }) {
  if (fixed) return <input type="hidden" name="athleteId" value={fixed} />;
  if (!athletes) return null;
  return (
    <F label="Athlete" name="athleteId">
      <select id="athleteId" name="athleteId" className="input" defaultValue="">
        <option value="" disabled>Choose…</option>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.sport}</option>)}
      </select>
    </F>
  );
}

function MetricSelect({ metrics }: { metrics: MetricOption[] }) {
  const sports = [...new Set(metrics.map((m) => m.sport))];
  return (
    <F label="Metric" name="metricId" hint="★ = can be verified and anchored">
      <select id="metricId" name="metricId" className="input" defaultValue="">
        <option value="" disabled>Choose…</option>
        {sports.map((s) => (
          <optgroup key={s} label={s}>
            {metrics.filter((m) => m.sport === s).map((m) => (
              <option key={m.id} value={m.id}>
                {m.is_anchorable ? "★ " : ""}{m.name} ({m.unit}, {m.direction === "LOWER_IS_BETTER" ? "lower" : "higher"} is better)
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </F>
  );
}

const Evidence = () => (
  <F label="Evidence (optional)" name="evidence" hint="PDF, PNG, JPG or WebP up to 4 MB. Its fingerprint becomes part of the record.">
    <EvidenceInput />
  </F>
);

const SubmitBox = ({ label }: { label: string }) => (
  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 44 }}>
    <input type="checkbox" name="submit" defaultChecked style={{ width: 20, height: 20 }} /> {label}
  </label>
);

export function PerformanceForm({ action, athletes, fixedAthlete, metrics, submitLabel }: { action: Act; athletes?: AthleteOption[]; fixedAthlete?: string; metrics: MetricOption[]; submitLabel: string }) {
  return (
    <ActionForm action={action} submitLabel="Save result">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} />
        <MetricSelect metrics={metrics} />
      </Row>
      <Row>
        <F label="Value" name="value"><input id="value" name="value" inputMode="decimal" className="input" placeholder="e.g. 12.40" /></F>
        <F label="Date" name="recordedOn"><input id="recordedOn" name="recordedOn" type="date" max={today()} defaultValue={today()} className="input" /></F>
        <F label="Event (optional)" name="eventName"><input id="eventName" name="eventName" className="input" placeholder="e.g. District Open" /></F>
      </Row>
      <Row>
        <F label="Conditions (optional)" name="conditions"><input id="conditions" name="conditions" className="input" placeholder="e.g. Wind +0.8 m/s, hand-timed" /></F>
        <Evidence />
      </Row>
      <SubmitBox label={submitLabel} />
    </ActionForm>
  );
}

export function AchievementForm({ action, athletes, fixedAthlete, submitLabel }: { action: Act; athletes?: AthleteOption[]; fixedAthlete?: string; submitLabel: string }) {
  return (
    <ActionForm action={action} submitLabel="Save achievement">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} />
        <F label="Type" name="kind">
          <select id="kind" name="kind" className="input" defaultValue="ACHIEVEMENT">
            <option value="ACHIEVEMENT">Achievement (tournament, award)</option>
            <option value="MILESTONE">Milestone (personal best, 100 sessions…)</option>
          </select>
        </F>
      </Row>
      <Row>
        <F label="Title" name="title"><input id="title" name="title" className="input" placeholder="e.g. Tournament winner" /></F>
        <F label="Result or position" name="result"><input id="result" name="result" className="input" placeholder="e.g. 1st" /></F>
      </Row>
      <Row>
        <F label="Tournament or event" name="eventName"><input id="eventName" name="eventName" className="input" placeholder="e.g. Mumbai Inter-Academy Meet · 100m" /></F>
        <F label="Date" name="achievedOn"><input id="achievedOn" name="achievedOn" type="date" max={today()} defaultValue={today()} className="input" /></F>
      </Row>
      <Evidence />
      <SubmitBox label={submitLabel} />
    </ActionForm>
  );
}

export function GoalForm({ action, athletes, fixedAthlete, metrics }: { action: Act; athletes?: AthleteOption[]; fixedAthlete?: string; metrics: MetricOption[] }) {
  return (
    <ActionForm action={action} submitLabel="Set goal">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} />
        <MetricSelect metrics={metrics} />
      </Row>
      <F label="Goal" name="title"><input id="title" name="title" className="input" placeholder="e.g. Improve 100m timing" /></F>
      <Row>
        <F label="Starting value" name="startValue" hint="Usually the latest result"><input id="startValue" name="startValue" inputMode="decimal" className="input" /></F>
        <F label="Target" name="targetValue" hint="Below the start for times, above for distances or runs"><input id="targetValue" name="targetValue" inputMode="decimal" className="input" /></F>
        <F label="Deadline" name="deadline"><input id="deadline" name="deadline" type="date" min={today()} className="input" /></F>
      </Row>
    </ActionForm>
  );
}

export function SessionForm({ action, athletes, teams }: { action: Act; athletes: AthleteOption[]; teams: { id: string; name: string }[] }) {
  return (
    <ActionForm action={action} submitLabel="Save session">
      <Row>
        <F label="Date" name="sessionDate"><input id="sessionDate" name="sessionDate" type="date" defaultValue={today()} className="input" /></F>
        <F label="Training type" name="type"><input id="type" name="type" className="input" placeholder="e.g. Speed training" list="session-types" /></F>
        <datalist id="session-types">
          {["Speed training", "Strength and conditioning", "Technique drills", "Speed endurance", "Net session", "Fielding drills", "Fitness", "Match simulation"].map((t) => <option key={t} value={t} />)}
        </datalist>
        <F label="Duration (min)" name="durationMin"><input id="durationMin" name="durationMin" inputMode="numeric" defaultValue="90" className="input" /></F>
        <F label="Intensity" name="intensity">
          <select id="intensity" name="intensity" className="input" defaultValue="MEDIUM">
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </F>
      </Row>
      <Row>
        <F label="Team" name="teamId">
          <select id="teamId" name="teamId" className="input" defaultValue={teams[0]?.id ?? ""}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </F>
        <F label="Exercises" name="exercises"><input id="exercises" name="exercises" className="input" placeholder="e.g. Block starts ×6, 30m flys ×4" /></F>
        <F label="Notes / observations" name="notes"><input id="notes" name="notes" className="input" placeholder="e.g. Improved sprint acceleration" /></F>
      </Row>
      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", width: "100%", margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 6px" }}>Attendance</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
          {athletes.map((a) => (
            <label key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14 }}>
              <span>{a.name}</span>
              <select name={`att_${a.id}`} className="input" style={{ width: 130, minHeight: 38, padding: "6px 8px" }} defaultValue="PRESENT" aria-label={`Attendance for ${a.name}`}>
                <option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="EXCUSED">Excused</option><option value="">Not planned</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}

export function FeedbackForm({ action, athleteId }: { action: Act; athleteId: string }) {
  return (
    <ActionForm action={action} submitLabel="Send feedback">
      <input type="hidden" name="athleteId" value={athleteId} />
      <F label="Feedback" name="body"><textarea id="body" name="body" className="input" rows={3} placeholder="What went well, what to work on next" /></F>
    </ActionForm>
  );
}
