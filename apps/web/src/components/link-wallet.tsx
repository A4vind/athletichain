"use client";

import { useState } from "react";
import { linkWalletAction } from "@/app/actions/records";
import { MetaMaskMissing } from "./metamask-missing";
import { getEthereum, noWalletMessage } from "./metamask-sign";

/** Sepolia only: prove you own a MetaMask wallet by signing a short message. */
export function LinkWallet({ coachCode, label = "Link MetaMask wallet" }: { coachCode: string; label?: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string; noWallet?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function link() {
    setBusy(true);
    const eth = await getEthereum();
    if (!eth) {
      setBusy(false);
      return setMsg({ error: noWalletMessage(), noWallet: true });
    }
    try {
      // Always show MetaMask's account picker, so the coach chooses which account to link.
      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const [address] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      // Put this site on Sepolia in MetaMask, so later approvals sign for the right chain.
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
      const message = `Link this wallet to AthletiChain coach ${coachCode} at ${Date.now()}`;
      const signature = (await eth.request({ method: "personal_sign", params: [message, address] })) as string;
      setMsg(await linkWalletAction(address, message, signature));
    } catch (err) {
      setMsg({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div><button type="button" className="btn btn-primary" onClick={link} disabled={busy}>{busy ? "Waiting for MetaMask…" : label}</button></div>
      {msg?.ok ? <div className="alert alert-ok">{msg.ok}</div> : null}
      {msg?.noWallet ? <MetaMaskMissing message={msg.error!} /> : msg?.error ? <div className="alert alert-error">{msg.error}</div> : null}
    </div>
  );
}
