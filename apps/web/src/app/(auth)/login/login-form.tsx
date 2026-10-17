"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Icon } from "@/components/icons";
import { loginAction, type FormState } from "../actions";
import { Field, Submit } from "../form-bits";

export type DemoAccount = { role: string; email: string; note: string };

export function LoginForm({ next, notice, demo }: { next?: string; notice?: string; demo?: DemoAccount[] }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  function fillDemo(d: DemoAccount) {
    if (email.current) email.current.value = d.email;
    if (password.current) password.current.value = "Demo@1234";
    form.current?.requestSubmit();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form ref={form} action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {notice ? <div className="alert alert-ok" role="status"><Icon name="check" size={18} /><div>{notice}</div></div> : null}
        {state.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{state.error}</div></div> : null}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field name="email" label="Email" type="email" autoComplete="email" required autoFocus placeholder="you@example.com" inputRef={email} defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <Field name="password" label="Password" aside={<Link href="/forgot-password" style={{ fontSize: 14 }}>Forgot password?</Link>} type="password" autoComplete="current-password" required inputRef={password} error={state.fieldErrors?.password} />
        <Submit>Log in</Submit>
      </form>

      {demo?.length ? (
        <section aria-labelledby="demo-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="or-line"><span id="demo-h">Or try a demo account</span></div>
          <div className="demo-grid">
            {demo.map((d) => (
              <button key={d.email} type="button" className="demo-card" onClick={() => fillDemo(d)}>
                <span className="demo-role">{d.role}</span>
                <span className="demo-note">{d.note}</span>
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>Demo accounts with sample data. Password for all: Demo@1234</p>
        </section>
      ) : null}
    </div>
  );
}
