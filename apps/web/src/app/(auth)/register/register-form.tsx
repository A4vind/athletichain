"use client";

import { startTransition, useActionState, useState } from "react";
import { registerAction, type FormState } from "../actions";
import { Field, Submit } from "../form-bits";
import { examplesFor } from "@/components/sport-examples";

type Option = { value: string; label: string };

function under18(dob: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  const age = now.getUTCFullYear() - d.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) ? 1 : 0);
  return age < 18;
}

/** Date picker limits matching the server rules: 5 to 100 years old, never in the future. */
function dobBounds() {
  const now = new Date();
  const shift = (years: number) => new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  return { min: shift(100), max: shift(5) };
}

export function RegisterForm({ sports, academies }: { sports: Option[]; academies: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  // Submit manually instead of <form action>, so React does not reset the form after a
  // failed attempt (the user keeps what they typed, including the dropdowns).
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const [role, setRole] = useState<"ATHLETE" | "COACH">((v.role as "ATHLETE" | "COACH") ?? "ATHLETE");
  // Controlled so React 19's automatic form reset doesn't wipe them after a failed submit.
  const [dob, setDob] = useState(v.dateOfBirth ?? "");
  const [sport, setSport] = useState(v.sportCode ?? "");
  const [academy, setAcademy] = useState(v.academyId ?? "");
  const minor = role === "ATHLETE" && under18(dob);

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {state.error ? <div className="alert alert-error" role="alert">{state.error}</div> : null}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>I am a…</legend>
        <div className="segmented">
          <input type="radio" id="role-athlete" name="role" value="ATHLETE" checked={role === "ATHLETE"} onChange={() => setRole("ATHLETE")} />
          <label htmlFor="role-athlete"><strong>Athlete</strong><span className="muted" style={{ fontSize: 13 }}>Track and share my records</span></label>
          <input type="radio" id="role-coach" name="role" value="COACH" checked={role === "COACH"} onChange={() => setRole("COACH")} />
          <label htmlFor="role-coach"><strong>Coach</strong><span className="muted" style={{ fontSize: 13 }}>Needs admin approval</span></label>
        </div>
      </fieldset>
      <Field name="fullName" label="Full name" autoComplete="name" defaultValue={v.fullName} error={fe.fullName} />
      <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={v.email} error={fe.email} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" error={fe.password} />
      <Field name="sportCode" label="Sport" error={fe.sportCode}>
        <select id="sportCode" name="sportCode" className="input" value={sport} onChange={(e) => setSport(e.target.value)} aria-invalid={fe.sportCode ? true : undefined}>
          <option value="" disabled>Choose a sport</option>
          {sports.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      {role === "COACH" ? (
        <Field name="academyId" label="Academy" error={fe.academyId}>
          <select id="academyId" name="academyId" className="input" value={academy} onChange={(e) => setAcademy(e.target.value)} aria-invalid={fe.academyId ? true : undefined}>
            <option value="" disabled>Choose your academy</option>
            {academies.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field name="dateOfBirth" label="Date of birth" error={fe.dateOfBirth}>
            <input id="dateOfBirth" name="dateOfBirth" type="date" min={dobBounds().min} max={dobBounds().max} className="input" value={dob} onChange={(e) => setDob(e.target.value)} aria-invalid={fe.dateOfBirth ? true : undefined} />
          </Field>
          <Field name="position" label="Position or event (optional)" defaultValue={v.position} hint={sport ? `e.g. ${examplesFor(sport).position}` : "Choose your sport above to see an example"} />
          {minor ? (
            <div className="card" style={{ background: "var(--wait-bg)", borderColor: "var(--wait-line)", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#f8e2ae" }}>
                You&apos;re under 18, so we need a parent or guardian. Your records can&apos;t be shared publicly until they give consent.
              </p>
              <Field name="guardianName" label="Guardian name" defaultValue={v.guardianName} />
              <Field name="guardianEmail" label="Guardian email" type="email" defaultValue={v.guardianEmail} error={fe.guardianEmail} />
            </div>
          ) : null}
        </>
      )}
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}
