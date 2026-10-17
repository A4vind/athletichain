import { sql } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { LinkWallet } from "@/components/link-wallet";
import { RecordsTable } from "@/components/records";
import { Empty, PageHead, Tile } from "@/components/ui";
import { anchorAction } from "@/app/actions/records";
import { chainNetwork, chainStatus, registry } from "@/server/blockchain/chain";
import { coachContext } from "@/server/services/coach-context";
import { listRecords } from "@/server/services/records";

export const metadata = { title: "Blockchain" };

export default async function CoachBlockchain() {
  const { coach } = await coachContext();
  const status = await chainStatus();
  let registered: boolean | null = null;
  if (status.ok && coach.walletAddress) {
    try {
      const v = await registry().verifiers(coach.walletAddress);
      registered = v.exists && v.activeUntil === 0n;
    } catch {
      registered = null;
    }
  }
  const records = await listRecords(sql`vr.verified_by = ${coach.id}`);
  const anchored = records.filter((r) => r.txHash).length;
  const waiting = records.filter((r) => r.status === "VERIFIED" && !r.txHash);

  return (
    <>
      <PageHead kicker={`Coach ${coach.publicCode}`} title="Blockchain" />
      {!status.ok ? <div className="alert alert-error">{status.error}</div> : null}
      <section className="tiles">
        <Tile label="Network" value={status.network === "sepolia" ? "Sepolia" : "Local chain"} sub={status.chainId ? `chain id ${status.chainId} · block ${status.block}` : "offline"} />
        <Tile label="Your wallet" value={coach.walletAddress ? `${coach.walletAddress.slice(0, 6)}…${coach.walletAddress.slice(-4)}` : "Not linked"} sub={registered === null ? "—" : registered ? "Registered verifier ✓" : "Not registered"} subTone={registered ? "good" : "warn"} />
        <Tile label="Records you verified" value={records.length} />
        <Tile dark label="Anchored on-chain" value={anchored} sub={waiting.length ? `${waiting.length} waiting to anchor` : "All anchored"} />
      </section>

      {!coach.walletAddress && chainNetwork() === "sepolia" ? (
        <section className="card">
          <div className="card-head"><h2>Link your wallet</h2></div>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>Your approvals are signed with this wallet. Signing the link message is free.</p>
          <LinkWallet coachCode={coach.publicCode} />
        </section>
      ) : null}
      {chainNetwork() === "localhost" ? (
        <div className="alert alert-info">Local chain: your wallet is Hardhat test account #{Number(coach.publicCode.replace(/\D/g, ""))}, linked automatically when you were approved. On Sepolia you&apos;d link MetaMask instead.</div>
      ) : null}

      {waiting.length ? (
        <section className="card">
          <div className="card-head"><h2>Verified but not anchored yet</h2></div>
          <RecordsTable
            records={waiting}
            showAthlete
            linkBase="/records"
            actions={(r) => (
              <ActionForm action={anchorAction} submitLabel="Anchor now" submitClass="btn btn-dark btn-sm" inlineSubmit>
                <input type="hidden" name="publicId" value={r.publicId} />
              </ActionForm>
            )}
          />
        </section>
      ) : null}

      <section className="card">
        <div className="card-head"><h2>Every record you verified</h2><span className="muted" style={{ fontSize: 13 }}>Open a record to run its integrity check</span></div>
        {records.length ? <RecordsTable records={records} showAthlete linkBase="/records" /> : <Empty title="You haven't verified anything yet" />}
      </section>
    </>
  );
}
