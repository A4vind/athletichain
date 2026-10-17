"use client";

import { forwardRef, useState } from "react";
import { useFormStatus } from "react-dom";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Password input with a Show / Hide button, so people can check what they typed. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input {...props} ref={ref} type={show ? "text" : "password"} className="input" />
      <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
});

export function Field({ name, label, aside, type = "text", error, defaultValue, hint, autoComplete, required, autoFocus, placeholder, inputRef, children }: {
  name: string; label: string; aside?: React.ReactNode; type?: string; error?: string; defaultValue?: string; hint?: string;
  autoComplete?: string; required?: boolean; autoFocus?: boolean; placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>; children?: React.ReactNode;
}) {
  const errId = `${name}-err`;
  const hintId = `${name}-hint`;
  const shared: InputProps = {
    id: name,
    name,
    defaultValue,
    autoComplete,
    required,
    autoFocus,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined,
  };
  return (
    <div className="field">
      {aside ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <label htmlFor={name}>{label}</label>
          {aside}
        </div>
      ) : (
        <label htmlFor={name}>{label}</label>
      )}
      {children ?? (type === "password" ? <PasswordInput {...shared} ref={inputRef} /> : <input {...shared} ref={inputRef} type={type} className="input" />)}
      {hint ? <span id={hintId} className="hint">{hint}</span> : null}
      {error ? <span id={errId} className="err" role="alert">{error}</span> : null}
    </div>
  );
}

export function Submit({ children, pending: pendingProp }: { children: React.ReactNode; pending?: boolean }) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingProp ?? formPending;
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={pending} style={{ minHeight: 48 }}>
      {pending ? <><span className="spin" aria-hidden="true" />Please wait…</> : children}
    </button>
  );
}
