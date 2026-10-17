import { Icon } from "@/components/icons";
import { sql } from "drizzle-orm";
import { ActionForm, F, Row } from "@/components/action-form";
import { RecordsTable } from "@/components/records";
import { Empty, PageHead, Tile } from "@/components/ui";
import { chainStatus } from "@/server/blockchain/chain";
import { db } from "@/server/db";
import { demoToolsEnabled } from "@/server/services/admin";
import { listRecords } from "@/server/services/records";
import { checkAllAction, restoreAction, tamperAction } from "../actions";

export const metadata = { title: "Blockchain" };

export default async function AdminBlockchain() {
  const status = await chainStatus();
  const anchored = await listRecords(sql`ba.tx_hash is not null`);
  const warnings = anchored.filter((r) => r.status === "INTEGRITY_WARNING");
  const failed = (await db.execute(sql`select count(*)::int as n from blockchain_anchors where status = 'FAILED'`)).rows[0] as { n: number };
  const tampered = new Set(
    ((await db.execute(sql`select old_value->>'publicId' as id from audit_logs where action = 'DEMO_TAMPER'`)).rows as { id: string }[]).map((r) => r.id),
  );
  const perf = anchored.filter((r) => r.kind === "PERFORMANCE");
  const demoDefault = perf.find((r) => r.athleteCode === "ATH-0007" && r.metricCode === "100m") ?? perf[0];

  return (
    <>
      <PageHead kicker="Proofs and verifiers" title="Blockchain" />
      {!status.ok ? <div className="alert alert-error">{status.error}</div> : null}
      <section className="tiles">
        <Tile label="Network" value={status.network === "sepolia" ? "Sepolia" : "Local chain"} sub={status.chainId ? `chain ${status.chainId} · block ${status.block}` : "offline"} subTone={status.ok ? "good" : "warn"} />
        <Tile label="Contract" value={status.contract ? `${status.contract.slice(0, 6)}…${status.contract.slice(-4)}` : "Not deployed"} sub="AthletiChainRegistry" />
        <Tile label="Relayer balance" value={status.relayerBalanceEth !== null ? `${status.relayerBalanceEth.toFixed(3)} ETH` : "—"} sub={status.relayer ? `${status.relayer.slice(0, 6)}…${status.relayer.slice(-4)}` : undefined} />
        <Tile dark label="Anchored records" value={anchored.length} sub={`${failed.n} failed transactions`} />
        <Tile label="Integrity warnings" value={warnings.length} subTone={warnings.length ? "warn" : "good"} sub={warnings.length ? "Investigate now" : "All proofs match"} />
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Check every proof</h2></div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Recomputes each anchored record from the database and compares it with the blockchain. Mismatches are flagged everywhere and logged.</p>
        <ActionForm action={checkAllAction} submitLabel="Run integrity check on all records" keepOnSuccess />
      </section>

      {warnings.length ? (
        <section className="card" style={{ borderColor: "var(--bad-line)" }}>
          <div className="card-head"><h2 style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--bad)" }}><Icon name="alert" size={18} />Integrity warnings</h2></div>
          <RecordsTable records={warnings} showAthlete linkBase="/records" />
        </section>
      ) : null}

      {demoToolsEnabled() && demoDefault ? (
        <section className="card" style={{ background: "var(--wait-bg)", borderColor: "var(--wait-line)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card-head" style={{ marginBottom: 0 }}><h2>Demo tools · simulate database tampering</h2><span className="badge badge-pending">development only</span></div>
          <p style={{ margin: 0, fontSize: 14 }}>
            The app refuses to edit verified records. This simulates someone changing the database directly (for example with a SQL client) so you can show the integrity check catching it. Every use is written to the audit log.
          </p>
          <ActionForm action={tamperAction} submitLabel="Change value in the database" submitClass="btn btn-danger">
            <Row>
              <F label="Anchored performance record" name="publicId">
                <select id="publicId" name="publicId" className="input" defaultValue={demoDefault.publicId}>
                  {perf.map((r) => <option key={r.id} value={r.publicId}>{r.publicId} · {r.athleteName} · {r.title} {r.display}</option>)}
                </select>
              </F>
              <F label="New value" name="value" hint="e.g. 12.10 for a faster, fake time"><input id="value" name="value" defaultValue="12.10" className="input" inputMode="decimal" /></F>
            </Row>
          </ActionForm>
          {tampered.size ? (
            <ActionForm action={restoreAction} submitLabel="Restore original value" submitClass="btn btn-ghost" inlineSubmit>
              <F label="Tampered record" name="restoreId">
                <select id="restoreId" name="publicId" className="input">{[...tampered].map((id) => <option key={id} value={id}>{id}</option>)}</select>
              </F>
            </ActionForm>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="card-head"><h2>All anchored records</h2></div>
        {anchored.length ? <RecordsTable records={anchored} showAthlete linkBase="/records" /> : <Empty title="Nothing anchored yet">Run <span className="mono">pnpm setup:local</span>, then approve a record as a coach.</Empty>}
      </section>
    </>
  );
}
