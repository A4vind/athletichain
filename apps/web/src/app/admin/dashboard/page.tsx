import Link from "next/link";
import { sql } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { Empty, PageHead, Tile } from "@/components/ui";
import { chainStatus, registry } from "@/server/blockchain/chain";
import { db } from "@/server/db";
import { adminDashboard } from "@/server/services/dashboards";
import { PendingCoaches } from "../pending-coaches";

export const metadata = { title: "Admin dashboard" };

type CoachWallet = { name: string; code: string; wallet: string | null; status: string };

export default async function AdminDashboard() {
  const [{ stats, pendingCoaches, recent, bySport }, status, academies, coaches] = await Promise.all([
    adminDashboard(),
    chainStatus(),
    db.execute(sql`select name from academies order by name`),
    db.execute(sql`select u.full_name as name, c.public_code as code, c.wallet_address as wallet, u.status from coaches c join users u on u.id = c.user_id order by c.public_code`),
  ]);
  const wallets = await Promise.all(
    (coaches.rows as CoachWallet[]).map(async (c) => {
      let onChain: boolean | null = null;
      if (status.ok && c.wallet) {
        try {
          const v = await registry().verifiers(c.wallet);
          onChain = v.exists && v.activeUntil === 0n;
        } catch {
          onChain = null;
        }
      }
      return { ...c, onChain };
    }),
  );
  const mismatched = wallets.filter((w) => w.wallet && w.onChain !== null && w.onChain !== (w.status === "ACTIVE"));
  const maxAthletes = Math.max(1, ...bySport.map((s) => s.athletes));
  const academyNames = (academies.rows as { name: string }[]).map((a) => a.name);

  return (
    <>
      <PageHead kicker={academyNames.length ? academyNames.join(" · ") : "No academies yet"} title="Admin dashboard">
        <Link href="/admin/audit-log" className="btn btn-ghost"><Icon name="log" size={18} />Audit log</Link>
        <Link href="/admin/blockchain" className="btn btn-primary"><Icon name="shield" size={18} />Check integrity</Link>
      </PageHead>

      {stats.warnings ? (
        <div className="alert alert-error" role="alert">
          <Icon name="alert" size={18} />
          <div><strong>{stats.warnings} {stats.warnings === 1 ? "record no longer matches" : "records no longer match"} the blockchain proof.</strong> <Link href="/admin/blockchain">Review integrity warnings</Link></div>
        </div>
      ) : null}

      <section className="tiles" aria-label="Summary">
        <Tile label="Coach approvals" value={stats.pending_coaches} sub={stats.pending_coaches ? "Waiting for you" : "None waiting"} subTone={stats.pending_coaches ? "warn" : "good"} />
        <Tile label="Athletes" value={stats.athletes} sub={`${stats.teams} teams · ${stats.academies} academies`} />
        <Tile label="Active coaches" value={stats.coaches} />
        <Tile label="Verified records" value={stats.verified} sub={`${stats.pending} pending review`} />
        <Tile dark label="Anchored on-chain" value={stats.anchored} sub={stats.warnings ? `${stats.warnings} integrity warnings` : "No integrity warnings"} subTone={stats.warnings ? "warn" : "good"} />
        <Tile label="Active users · 30 days" value={stats.active_users} />
      </section>

      <div className="grid-main">
        <div className="stack">
          <section className="card" aria-labelledby="pc-h">
            <div className="card-head">
              <h2 id="pc-h">Coaches awaiting approval</h2>
              <Link href="/admin/coaches" className="link">Open <Icon name="chevron" size={14} /></Link>
            </div>
            <p className="muted" style={{ margin: "-6px 0 12px", fontSize: 14 }}>Approving registers the coach&apos;s wallet as a verifier on the smart contract.</p>
            <PendingCoaches rows={pendingCoaches} />
          </section>

          <section className="card" aria-labelledby="wal-h">
            <div className="card-head">
              <h2 id="wal-h">Verifier wallet permissions</h2>
              <Link href="/admin/users?role=COACH" className="link">Manage coaches <Icon name="chevron" size={14} /></Link>
            </div>
            {mismatched.length ? (
              <div className="alert alert-warn" style={{ marginBottom: 12 }}>
                <Icon name="warning" size={18} />
                <div>{mismatched.length} {mismatched.length === 1 ? "wallet's" : "wallets'"} on-chain permission doesn&apos;t match the account status. Suspend and reinstate the coach to re-sync it.</div>
              </div>
            ) : null}
            {wallets.length ? (
              <div className="table-wrap">
                <table className="data stack-sm">
                  <thead><tr><th>Coach</th><th>Account</th><th>Wallet</th><th>On-chain verifier</th></tr></thead>
                  <tbody>
                    {wallets.map((w) => (
                      <tr key={w.code}>
                        <td className="lead"><strong>{w.name}</strong> <span className="mono muted" style={{ fontSize: 12 }}>{w.code}</span></td>
                        <td data-label="Account">
                          <span className={`badge ${w.status === "ACTIVE" ? "badge-verified" : w.status === "SUSPENDED" ? "badge-rejected" : "badge-pending"}`}>
                            {w.status === "PENDING_APPROVAL" ? "Awaiting approval" : w.status.charAt(0) + w.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td data-label="Wallet" className="mono" style={{ fontSize: 12.5 }}>{w.wallet ? `${w.wallet.slice(0, 6)}…${w.wallet.slice(-4)}` : "—"}</td>
                        <td data-label="On-chain">
                          {!w.wallet ? <span className="muted">No wallet</span> : w.onChain === null ? <span className="muted">Chain offline</span> : w.onChain ? (
                            <span className="badge badge-anchored"><Icon name="hexagon" size={14} />Can sign</span>
                          ) : (
                            <span className="badge badge-neutral">Not registered</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No coaches yet" icon="wallet" />
            )}
          </section>

          <section className="card" aria-labelledby="sp-h">
            <div className="card-head"><h2 id="sp-h">Athletes by sport</h2></div>
            {bySport.map((s) => (
              <div key={s.sport} style={{ display: "grid", gridTemplateColumns: "minmax(96px, 180px) minmax(0, 1fr) 32px", alignItems: "center", gap: 12, padding: "7px 0", fontSize: 14 }}>
                <span>{s.sport}{s.built ? "" : <span className="muted" style={{ fontSize: 12 }}> · metrics only</span>}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${(100 * s.athletes) / maxAthletes}%`, background: s.built ? "var(--accent)" : "var(--border-strong)" }} /></div>
                <span style={{ textAlign: "right" }}>{s.athletes}</span>
              </div>
            ))}
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="chain-h">
            <div className="card-head">
              <h2 id="chain-h">Blockchain</h2>
              <Link href="/admin/blockchain" className="link">Details <Icon name="chevron" size={14} /></Link>
            </div>
            <div className="list-row">
              <span className={`icon-chip ${status.ok ? "chain" : "bad"}`}><Icon name="chain" size={18} /></span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{status.ok ? (status.network === "sepolia" ? "Ethereum Sepolia" : "Local Hardhat chain") : "Chain unreachable"}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{status.ok ? `Chain id ${status.chainId} · block ${status.block}` : status.error}</div>
              </div>
            </div>
            {status.contract ? (
              <div className="list-row">
                <span className="icon-chip"><Icon name="file" size={18} /></span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>Registry contract</div>
                  <div className="mono muted break" style={{ fontSize: 12 }}>{status.contract}</div>
                </div>
              </div>
            ) : null}
            {status.relayer ? (
              <div className="list-row">
                <span className="icon-chip"><Icon name="wallet" size={18} /></span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>Relayer balance {status.relayerBalanceEth !== null ? `${status.relayerBalanceEth.toFixed(3)} ETH` : ""}</div>
                  <div className="mono muted break" style={{ fontSize: 12 }}>{status.relayer}</div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card" aria-labelledby="rec-h">
            <div className="card-head">
              <h2 id="rec-h">Recent activity</h2>
              <Link href="/admin/audit-log" className="link">Audit log <Icon name="chevron" size={14} /></Link>
            </div>
            {recent.length ? (
              recent.map((r, i) => (
                <div className="list-row" key={i}>
                  <span className="dot" style={{ background: "var(--text-3)" }} aria-hidden="true" />
                  <div className="grow">
                    <strong>{r.actor ?? "System"}</strong> {r.action.replaceAll("_", " ").toLowerCase()} <span className="muted">({r.entity})</span>
                  </div>
                  <span className="muted mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{r.at.slice(5)}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>No activity yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
