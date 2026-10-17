"use client";

import { use } from "react";
import { useActionState } from "react";
import { resetAction, type FormState } from "../../actions";
import { Field, Submit } from "../../form-bits";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, action] = useActionState<FormState, FormData>(resetAction, {});
  return (
    <>
      <div>
        <div className="eyebrow">Account recovery</div>
        <h1>Choose a new password</h1>
      </div>
      <form action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {state.error ? <div className="alert alert-error" role="alert">{state.error}</div> : null}
        <input type="hidden" name="token" value={token} />
        <Field name="password" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" error={state.fieldErrors?.password} />
        <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        <Submit>Update password</Submit>
      </form>
    </>
  );
}
