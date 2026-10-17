import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { assertCanView } from "@/server/services/record-access";
import { Icon } from "@/components/icons";
import { IntegrityPanel } from "@/components/integrity-panel";
import { statusTrust } from "@/components/records";
import { PageHead, TrustBadge, fmtDate } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/current-user";
import { explorerName, explorerTxUrl } from "@/server/blockchain/chain";
import { db } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { canonicalInputFor } from "@/server/services/records";
import { buildCanonical, canonicalJson } from "@athletichain/canonical";

export const metadata = { title: "Record" };

export default async function RecordPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const user = (await getCurrentUser())!;
  let r;
  try {
    r = await assertCanView(user, publicId);
  } catch (err) {
    if (err instanceof AppError) notFound();
    throw err;
  }

  const evidence = (
    await db.execute(sql`select id, file_name, mime_type, size_bytes, encode(sha256,'hex') as sha from evidence_files where record_id = ${r.id} order by created_at`)
  ).rows as { id: string; file_name: string; mime_type: string; size_bytes: number; sha: string }[];
  const history = (
    await db.execute(sql`
      select to_char(r.created_at, 'YYYY-MM-DD HH24:MI') as at, su.full_name as submitted_by, cu.full_name as coach, r.decision, r.reason,
             to_char(r.decided_at, 'YYYY-MM-DD HH24:MI') as decided_at
      from verification_requests r join users su on su.id = r.submitted_by join coaches c on c.id = r.assigned_coach join users cu on cu.id = c.user_id
      where r.record_id = ${r.id} order by r.created_at`)
  ).rows as { at: string; submitted_by: string; coach: string; decision: string | null; reason: string | null; decided_at: string | null }[];
  const canonical = r.verifierCode ? canonicalJson(buildCanonical(await canonicalInputFor(r, r.verifierCode))) : null;
  const explorer = r.txHash ? explorerTxUrl(r.txHash) : null;

  const status = r.status;
  const stages = [
    { label: "Submitted", on: status !== "DRAFT", icon: "check" as const },
    { label: status === "REJECTED" ? "Rejected by coach" : "Coach verified", on: ["VERIFIED", "ANCHORED", "INTEGRITY_WARNING", "SUPERSEDED"].includes(status), bad: status === "REJECTED", icon: "check" as const },
    { label: "Anchored on-chain", on: !!r.txHash, chain: true, icon: "hexagon" as const },
    { label: status === "INTEGRITY_WARNING" ? "Integrity mismatch" : r.lastIntegrityCheckAt ? "Integrity checked" : "Integrity not checked yet", on: !!r.lastIntegrityCheckAt && status !== "INTEGRITY_WARNING", bad: status === "INTEGRITY_WARNING", ok: true, icon: "shield" as const },
  ];

  return (
    <>
      <PageHead kicker={<><span>{r.kind.charAt(0) + r.kind.slice(1).toLowerCase()}</span> · <span className="mono">{r.publicId}</span></>} title={`${r.athleteName} · ${r.title}`}>
        <TrustBadge level={statusTrust(r.status)} />
      </PageHead>

      <section className="card" aria-label="Verification stages">
        <ol className="proof">
          {stages.map((st) => (
            <li key={st.label} className={`${st.on ? "on" : ""}${st.chain ? " chain" : ""}${st.ok ? " ok" : ""}${st.bad ? " bad" : ""}`}>
              <span className="lane" aria-hidden="true" />
              <span className="step"><Icon name={st.bad ? "alert" : st.on ? st.icon : "circle"} />{st.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="det-h" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h2 id="det-h">Record</h2>
          <div className="result">{r.display}</div>
          <div className="kv">
            <div><span>Athlete</span>{r.athleteName} <span className="mono muted" style={{ fontSize: 12 }}>{r.athleteCode}</span></div>
            <div><span>Date</span>{fmtDate(r.date)}</div>
            <div><span>Event</span>{r.event ?? "—"}</div>
            <div><span>Verified by</span>{r.verifierName ?? "Not yet"}{r.verifiedAt ? <div className="muted" style={{ fontSize: 12.5 }}>{fmtDate(new Date(r.verifiedAt).toISOString().slice(0, 10))}</div> : null}</div>
          </div>
          <div>
            <div className="section-title">Evidence, fingerprinted into the hash</div>
            {evidence.length ? (
              evidence.map((e) => (
                <a key={e.id} href={`/api/evidence/${e.id}`} target="_blank" rel="noreferrer" className="list-link" style={{ minHeight: 44 }}>
                  <span className="icon-chip"><Icon name="file" size={18} /></span>
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span className="break" style={{ display: "block", fontWeight: 550 }}>{e.file_name}</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>{Math.ceil(e.size_bytes / 1024)} KB · <span className="mono">{e.sha.slice(0, 8)}…{e.sha.slice(-4)}</span></span>
                  </span>
                  <Icon name="external" size={16} className="chev" />
                </a>
              ))
            ) : (
              <span className="muted" style={{ fontSize: 14 }}>No files attached</span>
            )}
          </div>
          {canonical ? (
            <div>
              <div className="section-title">Canonical record (sorted keys, salted) → SHA-256</div>
              <code className="hash">{user.role === "ATHLETE" ? canonical.replace(/"salt":"[0-9a-f]+"/, '"salt":"••••••••"') : canonical}</code>
            </div>
          ) : null}
        </section>

        <section className="card card-dark" aria-labelledby="chain-h" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 id="chain-h">On-chain proof</h2>
          {r.txHash ? (
            <dl className="kv" style={{ gridTemplateColumns: "1fr", margin: 0 }}>
              <div><dt>Network</dt><dd>{r.chainId === 31337 ? "Local Hardhat chain (31337)" : `Ethereum Sepolia (${r.chainId})`}</dd></div>
              <div><dt>Block</dt><dd>{r.blockNumber} · {r.blockTime ? new Date(r.blockTime).toLocaleString("en-IN") : "—"}</dd></div>
              <div><dt>Transaction</dt><dd className="mono break" style={{ fontSize: 12.5 }}>{r.txHash}</dd></div>
              <div><dt>Contract</dt><dd className="mono break" style={{ fontSize: 12.5 }}>{r.contractAddress}</dd></div>
              <div><dt>Verifier wallet</dt><dd><span className="mono break" style={{ fontSize: 12.5 }}>{r.verifierWallet}</span>{r.verifierName ? <span className="muted"> ({r.verifierName})</span> : null}</dd></div>
              <div><dt>Record hash</dt><dd className="mono break" style={{ fontSize: 12.5, color: "var(--chain)" }}>0x{r.canonicalHash}</dd></div>
            </dl>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Not anchored yet. A record is anchored when its coach approves it with a registered wallet.</p>
          )}
          {explorer ? (
            <a href={explorer} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>View on {explorerName()}<Icon name="external" size={16} /></a>
          ) : r.txHash ? (
            <span className="muted" style={{ fontSize: 13 }}>Recorded on the local test chain, which has no public explorer. On Sepolia this links to Etherscan.</span>
          ) : null}
        </section>
      </div>

      {r.canonicalHash ? (
        <section className="card" aria-labelledby="int-h">
          <div className="card-head"><h2 id="int-h">Verify record integrity</h2></div>
          <p className="muted" style={{ margin: "-4px 0 14px", fontSize: 14 }}>Rebuilds this record from the database, hashes it, and compares the result with the proof on the blockchain.</p>
          <IntegrityPanel publicId={r.publicId} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="hist-h">
        <div className="card-head"><h2 id="hist-h">Verification history</h2></div>
        {history.length ? (
          <div className="table-wrap">
            <table className="data stack-sm">
              <thead><tr><th>Submitted</th><th>By</th><th>Reviewer</th><th>Decision</th><th>Reason</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="lead mono" style={{ fontSize: 12.5 }}>{h.at}</td>
                    <td data-label="Submitted by">{h.submitted_by}</td>
                    <td data-label="Reviewer">{h.coach}</td>
                    <td data-label="Decision">{h.decision ? <span className={`badge ${h.decision === "APPROVED" ? "badge-verified" : "badge-rejected"}`}>{h.decision === "APPROVED" ? "Approved" : "Rejected"}</span> : <span className="badge badge-pending">Waiting</span>}</td>
                    <td data-label="Reason">{h.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Not submitted yet.</p>
        )}
      </section>
      <div><Link href={user.role === "ATHLETE" ? "/athlete/verification" : user.role === "COACH" ? "/coach/blockchain" : "/admin/blockchain"} className="btn btn-ghost">Back to all records</Link></div>
    </>
  );
}
