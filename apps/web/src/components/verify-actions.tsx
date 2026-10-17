"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { anchorWithSignature, approveAction, rejectAction } from "@/app/actions/records";
import type { ActionState } from "./action-form";
import { Icon } from "./icons";
import { signVerifyTypedData } from "./metamask-sign";

const STEPS = ["Coach approved", "Hash generated", "Signed by coach wallet", "Transaction confirmed"];

/** Approve (→ hash → signature → transaction) or reject, with the steps shown as they happen. */
export function VerifyActions({ publicId }: { publicId: string }) {
  const [state, approve, pending] = useActionState<ActionState, FormData>(approveAction, {});
  const [rejState, reject, rejecting] = useActionState<ActionState, FormData>(rejectAction, {});
  const [mm, setMm] = useState<ActionState | null>(null);
  const [showReject, setShowReject] = useState(false);
  const router = useRouter();

  const data = state.data as { state: string; txHash?: string; blockNumber?: number; typedData?: { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, string> } } | undefined;
  const done = (mm?.data as { state?: string } | undefined)?.state === "anchored" || data?.state === "anchored";
  const step = pending ? 1 : done ? 4 : data ? (data.state === "needs-signature" ? 2 : 2) : 0;

  async function signWithMetaMask() {
    if (!data?.typedData) return setMm({ error: "Nothing to sign yet" });
    try {
      const { signature, deadline } = await signVerifyTypedData(data.typedData);
      setMm(await anchorWithSignature(publicId, signature, deadline));
    } catch (err) {
      const e = err as { code?: number; message?: string };
      setMm({ error: e.code === 4001 ? "You cancelled the signature in MetaMask." : e.message ?? "Signing failed" });
    }
  }

  if (rejState.ok)
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="alert alert-ok" role="status" style={{ flex: "1 1 240px" }}><Icon name="check" size={18} /><div>{rejState.ok}</div></div>
        <button type="button" className="btn btn-ghost" onClick={() => router.refresh()}>Next record</button>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {step > 0 ? (
        <ol className="proof" aria-label="Verification progress">
          {STEPS.map((s, i) => {
            const on = i < step || done;
            return (
              <li key={s} className={`${on ? "on" : ""}${i === 3 ? " chain" : ""}`} aria-current={!on && i === step ? "step" : undefined}>
                <span className="lane" aria-hidden="true" />
                <span className="step">{on ? <Icon name={i === 3 ? "hexagon" : "check"} /> : pending && i === step ? <span className="spin" style={{ width: 12, height: 12 }} aria-hidden="true" /> : <Icon name="circle" />}{s}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!data && !state.error ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <form style={{ flex: "1 1 auto", display: "flex" }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(); f.set("publicId", publicId); startTransition(() => approve(f)); }}>
            <button type="submit" className="btn btn-primary" style={{ flex: "1 1 auto" }} disabled={pending || rejecting}>
              {pending ? <><span className="spin" aria-hidden="true" />Signing and sending transaction…</> : <><Icon name="hexagon" size={18} />Approve and anchor on-chain</>}
            </button>
          </form>
          <button type="button" className="btn btn-danger" style={{ flex: "0 1 auto" }} onClick={() => setShowReject(!showReject)} aria-expanded={showReject} disabled={pending}>
            <Icon name="x" size={18} />Reject
          </button>
        </div>
      ) : null}

      {showReject && !data ? (
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => reject(f)); }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: 14, borderRadius: 12, background: "var(--bad-bg)", border: "1px solid var(--bad-line)" }}
        >
          <input type="hidden" name="publicId" value={publicId} />
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label htmlFor={`reason-${publicId}`}>Reason for rejecting (the athlete sees this)</label>
            <input id={`reason-${publicId}`} name="reason" className="input" placeholder="e.g. Time not visible in the video" required minLength={3} />
          </div>
          <button type="submit" className="btn btn-danger" disabled={rejecting}>{rejecting ? <><span className="spin" aria-hidden="true" />Rejecting…</> : "Confirm rejection"}</button>
        </form>
      ) : null}
      {rejState.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{rejState.error}</div></div> : null}
      {state.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{state.error}</div></div> : null}

      {data?.state === "needs-signature" && !mm?.ok ? (
        <button type="button" className="btn btn-primary" onClick={signWithMetaMask}><Icon name="wallet" size={18} />Sign fingerprint in MetaMask</button>
      ) : null}

      {done ? (
        <div className="alert alert-info" role="status">
          <Icon name="hexagon" size={20} />
          <div>
            <strong>Approved.</strong> {(mm?.ok ?? state.ok) as string}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn-ghost btn-sm" href={`/records/${publicId}`}>Open record</a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>Next record</button>
            </div>
          </div>
        </div>
      ) : data && data.state !== "needs-signature" ? (
        <div className="alert alert-warn" role="status"><Icon name="warning" size={18} /><div>{state.ok}</div></div>
      ) : null}
      {mm?.error ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{mm.error}</div></div> : null}
    </div>
  );
}
