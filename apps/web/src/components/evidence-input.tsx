"use client";

import { useState } from "react";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/** File picker that refuses files the server would reject, before anything is uploaded. */
export function EvidenceInput() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <input
        id="evidence"
        name="evidence"
        type="file"
        accept={TYPES.join(",")}
        className="input"
        style={{ padding: 8 }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "evidence-size-err" : undefined}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          let msg: string | null = null;
          if (file && file.size > MAX_BYTES) msg = `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Evidence must be 4 MB or smaller. Try a smaller photo or a compressed PDF.`;
          else if (file && !TYPES.includes(file.type)) msg = "Evidence must be a PDF, PNG, JPG or WebP file.";
          if (msg) e.currentTarget.value = "";
          setError(msg);
        }}
      />
      {error ? <span id="evidence-size-err" className="err" role="alert">{error}</span> : null}
    </>
  );
}
