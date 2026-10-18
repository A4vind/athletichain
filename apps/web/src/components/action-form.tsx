"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Icon } from "./icons";

export type ActionState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; data?: unknown; nonce?: number };

/**
 * Form bound to a server action. Keeps what the user typed when the action fails,
 * clears it on success (unless keepOnSuccess), and announces the result.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClass = "btn btn-dark",
  keepOnSuccess,
  className,
  style,
  confirm,
  inlineSubmit,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  submitClass?: string;
  keepOnSuccess?: boolean;
  className?: string;
  style?: React.CSSProperties;
  confirm?: string;
  inlineSubmit?: boolean;
}) {
  const [state, run, pending] = useActionState<ActionState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !keepOnSuccess) ref.current?.reset();
  }, [state.nonce, state.ok, keepOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      style={{ display: "flex", flexDirection: inlineSubmit ? "row" : "column", gap: 12, alignItems: inlineSubmit ? "flex-end" : undefined, flexWrap: "wrap", ...style }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      {children}
      <div className={inlineSubmit ? undefined : "form-submit"} style={{ display: "flex", flexDirection: "column", gap: 8, width: inlineSubmit ? "auto" : "100%" }}>
        <div>
          <button type="submit" className={submitClass} disabled={pending}>
            {pending ? <><span className="spin" aria-hidden="true" />Working…</> : submitLabel}
          </button>
        </div>
        <div aria-live="polite">
          {state.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{state.error}</div></div> : null}
          {state.ok ? <div className="alert alert-ok" role="status"><Icon name="check" size={18} /><div>{state.ok}</div></div> : null}
        </div>
      </div>
    </form>
  );
}

/** Labelled form field. size="sm" lets short inputs (dates, numbers, selects) share a row, even on phones. */
export function F({ label, name, hint, children, size }: { label: string; name: string; hint?: string; children?: React.ReactNode; size?: "sm" }) {
  return (
    <div className="field" style={{ flex: size === "sm" ? "1 1 140px" : "1 1 220px", minWidth: 0 }}>
      <label htmlFor={name}>{label}</label>
      {children ?? <input id={name} name={name} className="input" />}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: "100%" }}>{children}</div>;
}
