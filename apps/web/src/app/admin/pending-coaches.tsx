"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Empty, fmtDate } from "@/components/ui";
import { approveCoachAction, rejectCoachAction } from "./actions";

type Pending = { user_id: string; name: string; email: string; code: string; academy: string | null; sport: string | null; created_at: string };

/**
 * Approve or reject new coaches. The result message lives here, above the list,
 * so it stays visible after the approved row leaves the list.
 */
export function PendingCoaches({ rows }: { rows: Pending[] }) {
  const [result, setResult] = useState<(ActionState & { who?: string }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  function run(kind: "approve" | "reject", c: Pending) {
    if (kind === "reject" && !window.confirm(`Reject ${c.name}'s coach registration? They won't be able to sign in.`)) return;
    setBusy(`${kind}:${c.user_id}`);
    const fd = new FormData();
    fd.set("userId", c.user_id);
    start(async () => {
      const r = await (kind === "approve" ? approveCoachAction : rejectCoachAction)({}, fd);
      setResult({ ...r, who: c.name });
      setBusy(null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div aria-live="polite">
        {result?.ok ? <div className="alert alert-ok"><Icon name="check" size={18} /><div><strong>{result.who}:</strong> {result.ok}</div></div> : null}
        {result?.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div><strong>{result.who}:</strong> {result.error}</div></div> : null}
      </div>
      {rows.length ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((c) => (
            <div key={c.user_id} className="list-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <span className="icon-chip wait"><Icon name="userCheck" size={18} /></span>
              <div className="grow" style={{ flex: "1 1 220px" }}>
                <div style={{ fontWeight: 600 }}>{c.name} <span className="mono muted" style={{ fontSize: 12, fontWeight: 400 }}>{c.code}</span></div>
                <div className="muted break" style={{ fontSize: 12.5 }}>{[c.email, c.academy, c.sport, `registered ${fmtDate(c.created_at)}`].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => run("approve", c)}>
                  {busy === `approve:${c.user_id}` ? <><span className="spin" aria-hidden="true" />Approving…</> : <><Icon name="check" size={16} />Approve</>}
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => run("reject", c)}>
                  {busy === `reject:${c.user_id}` ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No coaches waiting for approval" icon="userCheck">New coach registrations appear here.</Empty>
      )}
    </div>
  );
}
