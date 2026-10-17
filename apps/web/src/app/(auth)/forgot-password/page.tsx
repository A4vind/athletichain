"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotAction, type FormState } from "../actions";
import { Field, Submit } from "../form-bits";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(forgotAction, {});
  return (
    <>
      <div>
        <div className="eyebrow">Account recovery</div>
        <h1>Reset password</h1>
      </div>
      {state.message ? (
        <div className="alert alert-ok" role="status">{state.message}</div>
      ) : (
        <form action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {state.error ? <div className="alert alert-error" role="alert">{state.error}</div> : null}
          <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
          <Submit>Send reset link</Submit>
        </form>
      )}
      {state.devLink ? (
        <div className="alert alert-info" style={{ wordBreak: "break-all" }}>
          <strong>Development only:</strong> no mail server is configured, so here is the link that would be emailed:{" "}
          <a href={state.devLink}>{state.devLink}</a>
        </div>
      ) : null}
      <Link href="/login" style={{ fontSize: 15 }}>Back to log in</Link>
    </>
  );
}
