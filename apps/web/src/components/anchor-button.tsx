"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { anchorAction, anchorWithSignature } from "@/app/actions/records";
import type { ActionState } from "./action-form";
import { Icon } from "./icons";
import { signVerifyTypedData, type VerifyTypedData } from "./metamask-sign";

type Result = { state: string; typedData?: VerifyTypedData };

/**
 * Anchors a coach-verified record. On Sepolia the server returns the data to sign,
 * so this opens MetaMask straight away and sends the signature back.
 */
export function AnchorButton({ publicId }: { publicId: string }) {
  const [busy, setBusy] = useState<"" | "server" | "wallet" | "chain">("");
  const [res, setRes] = useState<ActionState | null>(null);
  const router = useRouter();

  async function run() {
    setRes(null);
    try {
      setBusy("server");
      const form = new FormData();
      form.set("publicId", publicId);
      let out = await anchorAction({}, form);
      const data = out.data as Result | undefined;
      if (data?.state === "needs-signature" && data.typedData) {
        setBusy("wallet");
        const { signature, deadline } = await signVerifyTypedData(data.typedData);
        setBusy("chain");
        out = await anchorWithSignature(publicId, signature, deadline);
      }
      setRes(out);
    } catch (err) {
      const e = err as { code?: number; message?: string };
      setRes({ error: e.code === 4001 ? "You cancelled the signature in MetaMask." : e.message ?? "Anchoring failed" });
    } finally {
      setBusy("");
    }
  }

  const anchored = (res?.data as Result | undefined)?.state === "anchored";
  const label = busy === "server" ? "Preparing…" : busy === "wallet" ? "Sign in MetaMask…" : busy === "chain" ? "Waiting for the block…" : "Anchor now";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
      {anchored ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>Refresh list</button>
      ) : (
        <button type="button" className="btn btn-dark btn-sm" onClick={run} disabled={Boolean(busy)}>
          {busy ? <span className="spin" aria-hidden="true" /> : <Icon name="hexagon" size={16} />}
          {label}
        </button>
      )}
      {res?.error ? <div className="alert alert-error" role="alert" style={{ width: "100%" }}><Icon name="warning" size={18} /><div>{res.error}</div></div> : null}
      {res?.ok ? (
        <div className={`alert ${anchored ? "alert-info" : "alert-warn"}`} role="status" style={{ width: "100%" }}>
          <Icon name={anchored ? "hexagon" : "warning"} size={18} /><div>{res.ok}</div>
        </div>
      ) : null}
    </div>
  );
}
