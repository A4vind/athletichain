import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/current-user";
import { HOME_FOR_ROLE } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const STEPS: { t: string; d: string; icon: IconName }[] = [
  { t: "Record", d: "The athlete or coach adds a result, with a photo or result sheet as proof.", icon: "plus" },
  { t: "Verify", d: "The athlete's coach checks the proof and approves it. Nobody can approve their own entry.", icon: "check" },
  { t: "Lock", d: "A fingerprint of the record is stored on the blockchain, signed by the coach.", icon: "hexagon" },
  { t: "Share", d: "The athlete shares a QR code. Anyone can scan it and see a live check.", icon: "qr" },
];

const ROLES: { title: string; icon: IconName; points: string[]; cta: string; href: string }[] = [
  {
    title: "Athletes",
    icon: "performance",
    points: ["See your progress, personal bests and goals", "Get results verified by your coach", "Share a verified profile with one QR code"],
    cta: "Create athlete profile",
    href: "/register",
  },
  {
    title: "Coaches",
    icon: "clipboard",
    points: ["Log training and attendance for your squad", "Review evidence and approve results", "Sign each approval with your own wallet"],
    cta: "Register as a coach",
    href: "/register",
  },
];

export default async function Landing() {
  const user = await getCurrentUser();
  const home = user ? HOME_FOR_ROLE[user.role] : null;
  return (
    <div id="top" style={{ background: "var(--bg)" }}>
      <header className="land-nav">
        <nav aria-label="Main" className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 64 }}>
          <Link href="/" className="brand" style={{ padding: 0 }}>
            <Logo size={28} />
            <span className="brand-name">AthletiChain</span>
          </Link>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <a href="#how" className="btn btn-plain land-hide-sm">How it works</a>
            <a href="#check" className="btn btn-plain land-hide-sm">Check a record</a>
            {home ? (
              <Link href={home} className="btn btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">Log in</Link>
                <Link href="/register" className="btn btn-primary">Sign up</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="wrap land-hero">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <span className="badge badge-anchored" style={{ alignSelf: "flex-start" }}><Icon name="hexagon" size={14} />Coach verified · blockchain secured</span>
          <h1 className="display" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>Prove every result you earn.</h1>
          <p className="text-2" style={{ fontSize: "clamp(16px, 2vw, 18.5px)", maxWidth: 540 }}>
            Your coach verifies your times, scores and medals. AthletiChain locks each one with a blockchain fingerprint, so a selector can check it in seconds with a QR code.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {home ? (
              <Link href={home} className="btn btn-primary land-cta">Go to my dashboard</Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary land-cta">Create free account</Link>
                <Link href="/login" className="btn btn-ghost land-cta">Log in</Link>
              </>
            )}
          </div>
          <ul className="land-ticks">
            <li><Icon name="check" size={16} />Free for athletes and coaches</li>
            <li><Icon name="check" size={16} />Selectors don&apos;t need an account</li>
            <li><Icon name="check" size={16} />No personal data goes on-chain</li>
          </ul>
        </div>

        <figure className="card" style={{ margin: 0, padding: 0, overflow: "hidden" }} aria-label="Example of a verified record">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", gap: 8, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 13 }}>Example verified record</span>
            <span className="badge badge-anchored"><Icon name="hexagon" size={14} />Blockchain anchored</span>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <div className="muted" style={{ fontSize: 14 }}>Rahul M. · Athletics · 100m</div>
                <div className="result" style={{ fontSize: "clamp(52px, 9vw, 80px)" }}>12.40<small>s</small></div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13.5 }}>
                <div className="muted">Verified by</div>
                <div style={{ fontWeight: 600 }}>Coach Anjali Rao</div>
              </div>
            </div>
            <ol className="proof" aria-label="How the record was verified">
              <li className="on"><span className="lane" /><span className="step"><Icon name="check" />Reported with proof</span></li>
              <li className="on ok"><span className="lane" /><span className="step"><Icon name="check" />Coach approved</span></li>
              <li className="on chain"><span className="lane" /><span className="step"><Icon name="hexagon" />Locked on-chain</span></li>
              <li className="on ok"><span className="lane" /><span className="step"><Icon name="shield" />Checked: unchanged</span></li>
            </ol>
          </div>
        </figure>
      </section>

      <section className="land-band">
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 className="display land-h2">Built for everyone on the team</h2>
          <div className="land-roles">
            {ROLES.map((r) => (
              <div key={r.title} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="icon-chip accent"><Icon name={r.icon} size={18} /></span>
                  <h3 style={{ fontSize: 19 }}>{r.title}</h3>
                </div>
                <ul className="land-list">{r.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}</ul>
                <Link href={r.href} className="btn btn-ghost" style={{ marginTop: "auto" }}>{r.cta}</Link>
              </div>
            ))}
            <div id="check" className="card" style={{ display: "flex", flexDirection: "column", gap: 14, scrollMarginTop: 80 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="icon-chip chain"><Icon name="search" size={18} /></span>
                <h3 style={{ fontSize: 19 }}>Selectors and organisers</h3>
              </div>
              <p className="text-2" style={{ fontSize: 14.5 }}>Got a code or QR from an athlete? Check it here. No account needed, and you only see what the athlete chose to share.</p>
              <form action="/verify" method="get" role="search" aria-label="Check a verification code" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                <label htmlFor="verify-code" className="sr-only">Verification code</label>
                <input id="verify-code" name="code" placeholder="VR-7Q2K8M4XPA" className="input mono" autoCapitalize="characters" autoComplete="off" style={{ textTransform: "uppercase" }} />
                <button type="submit" className="btn btn-primary"><Icon name="search" size={18} />Check record</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 28, scrollMarginTop: 64 }}>
        <div style={{ maxWidth: 640 }}>
          <h2 className="display land-h2">How a result becomes proof</h2>
          <p className="text-2" style={{ marginTop: 10, fontSize: 16 }}>Four steps, each done by a different person or system, so no single person can fake a record.</p>
        </div>
        <ol className="land-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="icon-chip accent"><Icon name={s.icon} size={18} /></span>
                <span className="muted" style={{ fontSize: 13 }}>Step {i + 1}</span>
              </div>
              <h3 style={{ fontSize: 18 }}>{s.t}</h3>
              <p className="text-2" style={{ fontSize: 14.5 }}>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="land-band">
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 className="display land-h2">Every result shows how far you can trust it</h2>
          <div className="land-roles">
            <div className="card"><span className="badge badge-self"><Icon name="circle" size={14} />Self-reported</span><p className="text-2" style={{ marginTop: 12, fontSize: 14.5 }}>Added by the athlete. Useful, but nobody has checked it yet.</p></div>
            <div className="card"><span className="badge badge-verified"><Icon name="check" size={14} />Coach verified</span><p className="text-2" style={{ marginTop: 12, fontSize: 14.5 }}>An approved coach reviewed the proof and signed off.</p></div>
            <div className="card"><span className="badge badge-anchored"><Icon name="hexagon" size={14} />Blockchain anchored</span><p className="text-2" style={{ marginTop: 12, fontSize: 14.5 }}>Coach verified and locked on-chain. Any later change is flagged straight away.</p></div>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div className="card land-final">
          <div>
            <h2 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 36px)" }}>Start building your verified record</h2>
            <p className="text-2" style={{ marginTop: 8 }}>It takes a minute to sign up. Your coach does the rest.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={home ?? "/register"} className="btn btn-primary land-cta">{home ? "Go to my dashboard" : "Create free account"}</Link>
            {home ? null : <Link href="/login" className="btn btn-ghost land-cta">Log in</Link>}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap" style={{ paddingTop: 22, paddingBottom: 28, fontSize: 14, color: "var(--text-3)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>AthletiChain · final-year project</span>
          <span>Fingerprints anchored on Ethereum. A blockchain proof shows a record hasn&apos;t changed since the named coach verified it.</span>
        </div>
      </footer>
    </div>
  );
}
