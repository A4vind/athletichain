"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, F, Row, type ActionState } from "./action-form";
import { EvidenceInput } from "./evidence-input";
import { examplesFor, mainSport, valueExample } from "./sport-examples";
import type { AthleteOption, MetricOption } from "@/server/services/queries";

type Act = (prev: ActionState, form: FormData) => Promise<ActionState>;
const today = () => new Date().toISOString().slice(0, 10);
const eg = (s: string) => `e.g. ${s}`;

/** Calls onReset when the surrounding form is cleared (ActionForm clears it after a successful save). */
function useFormReset<T extends HTMLElement & { form: HTMLFormElement | null }>(onReset?: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form || !onReset) return;
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [onReset]);
  return ref;
}

function AthleteSelect({ athletes, fixed, onChange }: { athletes?: AthleteOption[]; fixed?: string; onChange?: (id: string) => void }) {
  const ref = useFormReset<HTMLSelectElement>(onChange ? () => onChange("") : undefined);
  if (fixed) return <input type="hidden" name="athleteId" value={fixed} />;
  if (!athletes) return null;
  return (
    <F label="Athlete" name="athleteId">
      <select ref={ref} id="athleteId" name="athleteId" className="input" defaultValue="" onChange={(e) => onChange?.(e.target.value)}>
        <option value="" disabled>Choose…</option>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.sport}</option>)}
      </select>
    </F>
  );
}

function MetricSelect({ metrics, onChange }: { metrics: MetricOption[]; onChange?: (id: string) => void }) {
  const sports = [...new Set(metrics.map((m) => m.sport))];
  const ref = useFormReset<HTMLSelectElement>(onChange ? () => onChange("") : undefined);
  return (
    <F label="Metric" name="metricId" hint="★ = can be verified and anchored">
      <select ref={ref} id="metricId" name="metricId" className="input" defaultValue="" onChange={(e) => onChange?.(e.target.value)}>
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

/** A stable callback that sets a state back to its starting value. */
function useResetTo<T>(set: (v: T) => void, value: T) {
  const [fn] = useState(() => () => set(value));
  return fn;
}

/** Which sport's examples to show: the chosen metric's sport, else the chosen athlete's, else the most common one. */
function useSport(metrics: MetricOption[], athletes?: AthleteOption[], fallback?: string) {
  const [metricId, setMetricId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const metric = metrics.find((m) => m.id === metricId) ?? null;
  const athlete = athletes?.find((a) => a.id === athleteId);
  const sport = metric?.sport_code ?? athlete?.sport_code ?? fallback ?? mainSport([...(athletes ?? []).map((a) => a.sport_code), ...metrics.map((m) => m.sport_code)]);
  return { sport, metric, setMetricId, setAthleteId };
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
  const { sport, metric, setMetricId, setAthleteId } = useSport(metrics, athletes);
  const ex = examplesFor(sport);
  return (
    <ActionForm action={action} submitLabel="Save result">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} onChange={setAthleteId} />
        <MetricSelect metrics={metrics} onChange={setMetricId} />
      </Row>
      <Row>
        <F size="sm" label={metric ? `Value (${metric.unit})` : "Value"} name="value"><input id="value" name="value" inputMode="decimal" className="input" placeholder={valueExample(sport, metric)} /></F>
        <F size="sm" label="Date" name="recordedOn"><input id="recordedOn" name="recordedOn" type="date" max={today()} defaultValue={today()} className="input" /></F>
        <F label="Event (optional)" name="eventName"><input id="eventName" name="eventName" className="input" placeholder={eg(ex.event)} /></F>
      </Row>
      <Row>
        <F label="Conditions (optional)" name="conditions"><input id="conditions" name="conditions" className="input" placeholder={eg(ex.conditions)} /></F>
        <Evidence />
      </Row>
      <SubmitBox label={submitLabel} />
    </ActionForm>
  );
}

export function AchievementForm({ action, athletes, fixedAthlete, sportCode, submitLabel }: { action: Act; athletes?: AthleteOption[]; fixedAthlete?: string; sportCode?: string; submitLabel: string }) {
  const { sport, setAthleteId } = useSport([], athletes, sportCode);
  const [kind, setKind] = useState<"ACHIEVEMENT" | "MILESTONE">("ACHIEVEMENT");
  const kindRef = useFormReset<HTMLSelectElement>(useResetTo(setKind, "ACHIEVEMENT"));
  const ex = examplesFor(sport)[kind === "MILESTONE" ? "milestone" : "achievement"];
  return (
    <ActionForm action={action} submitLabel="Save achievement">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} onChange={setAthleteId} />
        <F label="Type" name="kind">
          <select ref={kindRef} id="kind" name="kind" className="input" defaultValue="ACHIEVEMENT" onChange={(e) => setKind(e.target.value as "ACHIEVEMENT" | "MILESTONE")}>
            <option value="ACHIEVEMENT">Achievement (tournament, award)</option>
            <option value="MILESTONE">Milestone (personal best, first win…)</option>
          </select>
        </F>
      </Row>
      <Row>
        <F label="Title" name="title"><input id="title" name="title" className="input" placeholder={eg(ex.title)} /></F>
        <F size="sm" label="Result or position" name="result"><input id="result" name="result" className="input" placeholder={eg(ex.result)} /></F>
      </Row>
      <Row>
        <F label="Tournament or event" name="eventName"><input id="eventName" name="eventName" className="input" placeholder={eg(ex.event)} /></F>
        <F size="sm" label="Date" name="achievedOn"><input id="achievedOn" name="achievedOn" type="date" max={today()} defaultValue={today()} className="input" /></F>
      </Row>
      <Evidence />
      <SubmitBox label={submitLabel} />
    </ActionForm>
  );
}

export function GoalForm({ action, athletes, fixedAthlete, metrics }: { action: Act; athletes?: AthleteOption[]; fixedAthlete?: string; metrics: MetricOption[] }) {
  const { sport, metric, setMetricId, setAthleteId } = useSport(metrics, athletes);
  const ex = examplesFor(sport);
  const lower = metric?.direction === "LOWER_IS_BETTER";
  return (
    <ActionForm action={action} submitLabel="Set goal">
      <Row>
        <AthleteSelect athletes={athletes} fixed={fixedAthlete} onChange={setAthleteId} />
        <MetricSelect metrics={metrics} onChange={setMetricId} />
      </Row>
      <F label="Goal" name="title"><input id="title" name="title" className="input" placeholder={eg(ex.goal)} /></F>
      <Row>
        <F label={metric ? `Starting value (${metric.unit})` : "Starting value"} name="startValue" hint="Usually the latest result"><input id="startValue" name="startValue" inputMode="decimal" className="input" placeholder={valueExample(sport, metric)} /></F>
        <F label={metric ? `Target (${metric.unit})` : "Target"} name="targetValue" hint={metric ? (lower ? "Lower than the start: lower is better here" : "Higher than the start: higher is better here") : "Below the start for times and rankings, above for scores and distances"}><input id="targetValue" name="targetValue" inputMode="decimal" className="input" /></F>
        <F label="Deadline" name="deadline"><input id="deadline" name="deadline" type="date" min={today()} className="input" /></F>
      </Row>
    </ActionForm>
  );
}

export function SessionForm({ action, athletes, teams, sportCode }: { action: Act; athletes: AthleteOption[]; teams: { id: string; name: string }[]; sportCode?: string }) {
  const ex = examplesFor(sportCode ?? mainSport(athletes.map((a) => a.sport_code)));
  return (
    <ActionForm action={action} submitLabel="Save session">
      <Row>
        <F size="sm" label="Date" name="sessionDate"><input id="sessionDate" name="sessionDate" type="date" defaultValue={today()} className="input" /></F>
        <F size="sm" label="Team" name="teamId">
          <select id="teamId" name="teamId" className="input" defaultValue={teams[0]?.id ?? ""}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </F>
      </Row>
      <Row>
        <F label="Training type" name="type" hint="Pick a suggestion or type your own"><input id="type" name="type" className="input" placeholder={eg(ex.sessionTypes[0])} list="session-types" /></F>
        <datalist id="session-types">
          {ex.sessionTypes.map((t) => <option key={t} value={t} />)}
        </datalist>
      </Row>
      <Row>
        <F size="sm" label="Duration (min)" name="durationMin"><input id="durationMin" name="durationMin" inputMode="numeric" defaultValue="90" className="input" /></F>
        <F size="sm" label="Intensity" name="intensity">
          <select id="intensity" name="intensity" className="input" defaultValue="MEDIUM">
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </F>
      </Row>
      <Row>
        <F label="Exercises" name="exercises"><input id="exercises" name="exercises" className="input" placeholder={eg(ex.exercises)} /></F>
        <F label="Notes / observations" name="notes"><input id="notes" name="notes" className="input" placeholder={eg(ex.notes)} /></F>
      </Row>
      <fieldset className="attendance">
        <legend>Attendance</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 8 }}>
          {athletes.map((a) => (
            <label key={a.id} className="attendance-row">
              <span>{a.name}</span>
              <select name={`att_${a.id}`} className="input" defaultValue="PRESENT" aria-label={`Attendance for ${a.name}`}>
                <option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="EXCUSED">Excused</option><option value="">Not planned</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}

export function FeedbackForm({ action, athleteId, sportCode }: { action: Act; athleteId: string; sportCode?: string }) {
  return (
    <ActionForm action={action} submitLabel="Send feedback">
      <input type="hidden" name="athleteId" value={athleteId} />
      <F label="Feedback" name="body"><textarea id="body" name="body" className="input" rows={3} placeholder={sportCode ? eg(examplesFor(sportCode).feedback) : "What went well, what to work on next"} /></F>
    </ActionForm>
  );
}
