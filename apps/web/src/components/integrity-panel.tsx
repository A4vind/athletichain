"use client";

import { startTransition, useActionState } from "react";
import { integrityAction } from "@/app/actions/records";
import type { ActionState } from "./action-form";
import { Icon } from "./icons";

type Result = {
  state: "MATCH" | "MISMATCH" | "NOT_ANCHORED" | "UNREACHABLE" | "NOT_VERIFIED";
  dbHash: string | null;
  storedHash: string | null;
  chainHash: string | null;
  chainVerifier: string | null;
  verifierMatches: boolean | null;
  message: string;
  checkedAt: string;
};

const Hash = ({ label, value, tone }: { label: string; value: string | null; tone?: "bad" | "chain" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
    <code className={`hash${tone ? ` ${tone}` : ""}`}>{value ? `0x${value}` : "—"}</code>
  </div>
);

/** Live integrity check: recomputes the record's hash and compares it with the on-chain proof. */
export function IntegrityPanel({ publicId }: { publicId: string }) {
  const [state, run, pending] = useActionState<ActionState, FormData>(integrityAction, {});
  const r = state.data as Result | undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("publicId", publicId);
          startTransition(() => run(fd));
        }}
      >
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <><span className="spin" aria-hidden="true" />Checking the chain…</> : <><Icon name="shield" size={18} />{r ? "Check again" : "Run integrity check"}</>}
        </button>
      </form>
      {state.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{state.error}</div></div> : null}
      {r ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-live="polite">
          <Hash label="1 · Recomputed now from the database" value={r.dbHash} tone={r.state === "MISMATCH" ? "bad" : undefined} />
          {r.chainHash !== null ? <Hash label="2 · Proof stored on the blockchain" value={r.chainHash} tone="chain" /> : <Hash label="2 · Hash fixed when the coach verified" value={r.storedHash} />}
          {r.state === "MATCH" ? (
            <div className="alert alert-ok" style={{ fontSize: 15 }}>
              <Icon name="hexagon" size={20} />
              <div><strong>Record matches the blockchain proof.</strong> {r.verifierMatches ? "Signed by the coach's registered wallet." : ""}<div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Checked {new Date(r.checkedAt).toLocaleString("en-IN")}</div></div>
            </div>
          ) : r.state === "MISMATCH" ? (
            <div className="alert alert-error" style={{ fontSize: 15, borderWidth: 2 }}>
              <Icon name="alert" size={20} />
              <div><strong>Blockchain integrity mismatch.</strong> {r.message} The record is now flagged everywhere it appears, and admins have been notified.</div>
            </div>
          ) : (
            <div className="alert alert-info"><Icon name="warning" size={18} /><div>{r.message}</div></div>
          )}
        </div>
      ) : null}
    </div>
  );
}
