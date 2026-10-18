"use client";

import { isMobile, metaMaskAppLink } from "./metamask-sign";

/** Shown when no wallet is found: on a phone, offers to reopen this page inside the MetaMask app. */
export function MetaMaskMissing({ message }: { message: string }) {
  const phone = typeof navigator !== "undefined" && isMobile();
  return (
    <div className="alert alert-error" role="alert" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div>{message}</div>
      {phone ? (
        <a className="btn btn-primary" href={metaMaskAppLink()}>Open in MetaMask app</a>
      ) : (
        <a className="btn btn-ghost" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>
      )}
    </div>
  );
}
