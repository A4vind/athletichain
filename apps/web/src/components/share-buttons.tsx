"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

/** Copy a link, or open the phone's share sheet when the browser supports it. */
export function ShareButtons({ url, title, size = "sm" }: { url: string; title: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const cls = `btn btn-ghost${size === "sm" ? " btn-sm" : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className={cls} onClick={copy}>
        <Icon name={copied === "ok" ? "check" : "copy"} size={16} />
        {copied === "ok" ? "Link copied" : copied === "fail" ? "Copy failed" : "Copy link"}
      </button>
      {canShare ? (
        <button type="button" className={cls} onClick={share}>
          <Icon name="share" size={16} />
          Share
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite">{copied === "ok" ? "Link copied to clipboard" : copied === "fail" ? "Could not copy the link" : ""}</span>
    </div>
  );
}
