import Link from "next/link";
import { headers } from "next/headers";
import { Icon } from "@/components/icons";
import { ShareButtons } from "@/components/share-buttons";
import { Logo, fmtDate } from "@/components/ui";
import { rateLimit } from "@/server/lib/rate-limit";
import { explorerName, explorerTxUrl } from "@/server/blockchain/chain";
import { publicUrl, qrSvg, resolveShare } from "@/server/services/sharing";
import { checkIntegrity } from "@/server/services/verification";

export const metadata = { title: "Verified record", robots: { index: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KIND: Record<string, string> = { PERFORMANCE: "Performance", MILESTONE: "Milestone", ACHIEVEMENT: "Achievement" };

function Frame({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}>
        <div className="wrap" style={{ maxWidth: 1040, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14, paddingBottom: 14 }}>
          <Link href="/" className="brand" style={{ padding: 0 }}><Logo /><span className="brand-name">AthletiChain</span></Link>
          <span className="mono muted" style={{ fontSize: 12.5 }}>{code}</span>
        </div>
      </header>
      <div className="wrap" style={{ maxWidth: 1040, paddingTop: 28, paddingBottom: 56, display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
    </main>
  );
}

/** Public page opened from a QR code or shared link. Runs a live integrity check every time. */
export default async function PublicVerify({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`verify:${ip}`, 60, 60_000).ok) {
    return (
      <Frame code={code}>
        <div className="card"><h1 style={{ fontSize: 26 }}>Too many lookups</h1><p className="muted" style={{ marginTop: 8 }}>Please wait a minute and try again.</p></div>
      </Frame>
    );
  }
  const share = /^VR-[A-Z2-9]{10}$/.test(code) ? await resolveShare(code) : ({ state: "invalid" } as const);

  if (share.state !== "ok") {
    const copy = {
      revoked: ["This link was withdrawn", "The athlete has withdrawn this link. Ask them for a new one."],
      expired: ["This link has expired", "Links stop working after the date the athlete chose. Ask them for a new one."],
      invalid: ["This isn't a valid verification link", "Check the code and try again. AthletiChain codes look like VR-7Q2K8M4XPA."],
    }[share.state];
    return (
      <Frame code={code}>
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span className="icon-chip bad"><Icon name="x" /></span>
          <div>
            <h1 style={{ fontSize: 24 }}>{copy[0]}</h1>
            <p className="muted" style={{ marginTop: 6 }}>{copy[1]}</p>
            <form action="/verify" method="get" style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <label htmlFor="code" className="sr-only">Verification code</label>
              <input id="code" name="code" className="input" placeholder="VR-XXXXXXXXXX" style={{ flex: "1 1 200px", textTransform: "uppercase" }} />
              <button type="submit" className="btn btn-primary">Check code</button>
            </form>
          </div>
        </div>
      </Frame>
    );
  }

  const checks = await Promise.all(share.records.map((r) => checkIntegrity(r.publicId, null)));
  const anchored = share.records.filter((r) => r.txHash).length;
  const mismatches = checks.filter((c) => c.state === "MISMATCH").length;
  const url = publicUrl(code);
  const qr = await qrSvg(code);

  return (
    <Frame code={code}>
      <section className="welcome" aria-labelledby="ath-h">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{share.scope === "PROFILE" ? "Verified athlete profile" : "Verified athlete record"}</p>
          <h1 id="ath-h" style={{ marginTop: 4 }}>{share.athlete.display}</h1>
          <p className="meta">{[share.athlete.sport, share.athlete.position, share.athlete.academy].filter(Boolean).join(" · ")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge badge-verified"><Icon name="check" size={14} />{share.records.length} coach verified</span>
          {anchored ? <span className="badge badge-anchored"><Icon name="hexagon" size={14} />{anchored} anchored</span> : null}
          {mismatches ? <span className="badge badge-warning"><Icon name="alert" size={14} />{mismatches} failed check</span> : null}
        </div>
      </section>

      <div className="grid-main">
        <div className="stack">
          {share.records.length ? null : <div className="card muted">No verified records are included in this link.</div>}
          {share.records.map((r, i) => {
            const check = checks[i];
            const tx = r.txHash ? explorerTxUrl(r.txHash) : null;
            const tone = check.state === "MATCH" ? "chain" : check.state === "MISMATCH" ? "bad" : check.state === "NOT_ANCHORED" ? "ok" : "wait";
            const label = check.state === "MATCH" ? "Matches its blockchain proof" : check.state === "MISMATCH" ? "Integrity warning: changed after verification" : check.state === "NOT_ANCHORED" ? "Coach verified, not anchored on-chain" : "Live check unavailable right now";
            return (
              <article key={r.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 16, borderColor: check.state === "MISMATCH" ? "var(--bad)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="muted" style={{ fontSize: 13 }}>{KIND[r.kind] ?? r.kind}{r.event ? ` · ${r.event}` : ""}</div>
                    <h2 style={{ fontSize: 19, marginTop: 2 }}>{r.title}</h2>
                  </div>
                  <div className="result" style={{ fontSize: "clamp(34px, 7vw, 46px)" }}>{r.display}</div>
                </div>
                <div className={`alert ${tone === "chain" ? "alert-info" : tone === "bad" ? "alert-error" : tone === "ok" ? "alert-ok" : "alert-warn"}`}>
                  <Icon name={check.state === "MATCH" ? "hexagon" : check.state === "MISMATCH" ? "alert" : check.state === "NOT_ANCHORED" ? "check" : "warning"} size={18} />
                  <div><strong>{label}.</strong>{check.state === "MISMATCH" || check.state === "UNREACHABLE" ? <span style={{ opacity: 0.85 }}> {check.message}</span> : check.state === "MATCH" && check.verifierMatches ? " Signed by the coach's registered wallet." : null}</div>
                </div>
                <div className="kv">
                  <div><span>Date</span>{fmtDate(r.date)}</div>
                  <div><span>Verified by</span>Coach {r.verifierName}</div>
                  <div><span>Checked</span>Just now, live</div>
                </div>
                {r.txHash ? (
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--text-2)", minHeight: 32 }}>Transaction details · block {r.blockNumber}</summary>
                    <code className="hash chain" style={{ marginTop: 8 }}>{r.txHash}</code>
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      {tx ? <a href={tx} target="_blank" rel="noreferrer">View on {explorerName()}</a> : <span className="muted">Recorded on a local test chain, which has no public explorer.</span>}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}

          {share.selfReported.length ? (
            <section className="card">
              <div className="card-head"><h2>Self-reported, not verified</h2></div>
              {share.selfReported.map((s, i) => (
                <div className="list-row" key={i} style={{ flexWrap: "wrap" }}>
                  <span className="badge badge-self"><Icon name="circle" size={14} />Self-reported</span>
                  <span className="grow">{s.title} · {s.display}</span>
                  <span className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(s.date)}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2>Share this verification</h2>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div className="qr" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <div style={{ flex: "1 1 160px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="mono muted break" style={{ fontSize: 12.5 }}>{url}</span>
                <ShareButtons url={url} title={`${share.athlete.display} · AthletiChain verified`} />
              </div>
            </div>
          </section>
          <section className="card" style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <h2>What this proves</h2>
            <p className="text-2">A blockchain proof shows the record hasn&apos;t changed since the named coach verified it. It doesn&apos;t prove the measurement itself, which is why the verifier is always named.</p>
            <p className="muted">
              Shared by the athlete{share.expiresAt ? `. Link valid until ${fmtDate(share.expiresAt.toISOString().slice(0, 10))}` : ""}. Contact details and date of birth stay private.
            </p>
          </section>
        </aside>
      </div>
    </Frame>
  );
}
