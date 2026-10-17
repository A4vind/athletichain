"use client";

import { Icon } from "./icons";

/** Error boundary content: says what happened and offers a retry. */
export function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert" style={{ display: "flex", gap: 14, alignItems: "flex-start", maxWidth: 640 }}>
      <span className="icon-chip bad"><Icon name="warning" /></span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <h1 style={{ fontSize: 20 }}>This page couldn&apos;t load</h1>
        <p className="text-2" style={{ fontSize: 14.5 }}>
          The server hit an error while loading it. If the database or the local blockchain was just restarted, trying again usually works.
        </p>
        {error.digest ? <p className="muted mono" style={{ fontSize: 12 }}>Reference {error.digest}</p> : null}
        <div><button type="button" className="btn btn-primary btn-sm" onClick={reset}>Try again</button></div>
      </div>
    </div>
  );
}
