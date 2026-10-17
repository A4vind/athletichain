import type { TrustLevel } from "@/server/services/dashboards";
import { Icon, type IconName } from "./icons";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="28" height="28" rx="8" fill="#15223a" stroke="#ff8a3d" strokeWidth="2" />
      <path d="M7 20 L13 10 L17 16 L23 8" stroke="#e8edf6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRUST: Record<TrustLevel, { cls: string; label: string; icon: IconName }> = {
  SELF_REPORTED: { cls: "badge-self", label: "Self-reported", icon: "circle" },
  COACH_VERIFIED: { cls: "badge-verified", label: "Coach verified", icon: "check" },
  ANCHORED: { cls: "badge-anchored", label: "Blockchain anchored", icon: "hexagon" },
  PENDING: { cls: "badge-pending", label: "Pending review", icon: "clock" },
  REJECTED: { cls: "badge-rejected", label: "Rejected", icon: "x" },
  INTEGRITY_WARNING: { cls: "badge-warning", label: "Integrity warning", icon: "alert" },
};

export function TrustBadge({ level, short }: { level: TrustLevel; short?: boolean }) {
  const t = TRUST[level];
  const label = short && level === "ANCHORED" ? "Anchored" : t.label;
  return (
    <span className={`badge ${t.cls}`}>
      <Icon name={t.icon} size={14} />
      {label}
    </span>
  );
}

export function Tile({ label, value, sub, dark, subTone, small }: { label: string; value: React.ReactNode; sub?: React.ReactNode; dark?: boolean; subTone?: "good" | "warn"; small?: boolean }) {
  return (
    <div className={`tile${dark ? " tile-dark" : ""}`}>
      <div className="tile-label">{label}</div>
      <div className={`tile-value${small ? " small" : ""}`}>{value}</div>
      {sub ? <div className={`tile-sub${subTone ? ` ${subTone}` : ""}`}>{sub}</div> : null}
    </div>
  );
}

export function Empty({ title, children, icon = "circle", action }: { title: string; children?: React.ReactNode; icon?: IconName; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {children ? <div style={{ maxWidth: 420 }}>{children}</div> : null}
      {action}
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1 className="break">{title}</h1>
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, risk, label }: { value: number; risk?: boolean; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`bar${risk ? " risk" : v >= 100 ? " done" : ""}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
}

export function fmtValue(v: number, decimals: number) {
  return v.toFixed(decimals);
}
