import Link from "next/link";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link href="/" className="brand" style={{ padding: 0 }}>
          <Logo size={28} />
          <span className="brand-name">AthletiChain</span>
        </Link>
        <Link href="/" className="btn btn-plain btn-sm auth-home">Back to home</Link>
        <div className="auth-pitch" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 460 }}>
          <p className="display" style={{ fontSize: "clamp(32px, 3.6vw, 48px)" }}>Track. Verify. Improve.</p>
          <p className="text-2" style={{ fontSize: 17 }}>
            Every result your coach signs off becomes a tamper-evident record you carry from academy to academy.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}>
            <li style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="icon-chip ok"><Icon name="check" size={18} /></span>Results approved by your own coach</li>
            <li style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="icon-chip chain"><Icon name="hexagon" size={18} /></span>Fingerprints stored on a blockchain</li>
            <li style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="icon-chip accent"><Icon name="qr" size={18} /></span>Share a verified profile with one QR code</li>
          </ul>
        </div>
        <p className="auth-pitch muted" style={{ fontSize: 13 }}>No names, results or files go on-chain, only a salted fingerprint.</p>
      </aside>
      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
