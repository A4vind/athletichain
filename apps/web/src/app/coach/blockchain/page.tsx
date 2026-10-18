import Link from "next/link";
import { sql } from "drizzle-orm";
import { AnchorButton } from "@/components/anchor-button";
import { LinkWallet } from "@/components/link-wallet";
import { RecordsTable } from "@/components/records";
import { Icon } from "@/components/icons";
import { Empty, PageHead, Tile } from "@/components/ui";
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
      {!status.ok ? <div className="alert alert-error" role="alert"><Icon name="warning" size={18} /><div>{status.error}</div></div> : null}
      <section className="tiles">
        <Tile label="Network" small value={status.network === "sepolia" ? "Sepolia" : "Local chain"} sub={status.chainId ? `chain id ${status.chainId} · block ${status.block}` : "offline"} />
        <Tile
          label="Your wallet"
          small
          value={coach.walletAddress ? <span className="mono" title={coach.walletAddress}>{`${coach.walletAddress.slice(0, 6)}…${coach.walletAddress.slice(-4)}`}</span> : "Not linked"}
          sub={!coach.walletAddress ? "Link a wallet to anchor records" : registered === null ? "Registration status unavailable" : registered ? "Registered verifier ✓" : "Not registered as verifier"}
          subTone={registered ? "good" : "warn"}
        />
        <Tile label="Records you verified" value={records.length} />
        <Tile dark label="Anchored on-chain" value={anchored} sub={waiting.length ? `${waiting.length} waiting to anchor` : "All anchored"} />
      </section>

      {!coach.walletAddress && chainNetwork() === "sepolia" ? (
        <section className="card">
          <div className="card-head"><h2>Link your wallet</h2></div>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>
            Your approvals are signed with this wallet. Signing the link message is free.{" "}
            <Link href="/help/metamask">New to MetaMask? See the 5-minute setup guide</Link>
          </p>
          <LinkWallet coachCode={coach.publicCode} />
        </section>
      ) : null}
      {coach.walletAddress && chainNetwork() === "sepolia" ? (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Use a different wallet</summary>
          <p className="muted" style={{ margin: "12px 0", fontSize: 14 }}>
            MetaMask will ask which account to link. The current wallet stops being a verifier; records it already anchored stay valid.
          </p>
          <LinkWallet coachCode={coach.publicCode} label="Choose another MetaMask account" />
        </details>
      ) : null}
      <section className="card" aria-labelledby="how-h">
        <div className="card-head"><h2 id="how-h">How anchoring works</h2></div>
        <ol className="how-steps">
          <li>
            <span className="icon-chip ok"><Icon name="check" size={18} /></span>
            <div><strong>You approve</strong><p className="muted">The record is coach verified and its fingerprint (SHA-256 hash) is fixed.</p></div>
          </li>
          <li>
            <span className="icon-chip accent"><Icon name="wallet" size={18} /></span>
            <div><strong>You sign a message</strong><p className="muted">{chainNetwork() === "sepolia" ? "MetaMask asks you to sign the fingerprint. This is a signature, not a payment: it spends no ETH." : "On the local chain your demo wallet signs the fingerprint automatically. On Sepolia, MetaMask asks you to sign."}</p></div>
          </li>
          <li>
            <span className="icon-chip chain"><Icon name="hexagon" size={18} /></span>
            <div><strong>The relayer submits the transaction</strong><p className="muted">AthletiChain sends your signature to the contract and pays the network fee. The record shows as anchored only after the block confirms.</p></div>
          </li>
        </ol>
      </section>

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
              <AnchorButton publicId={r.publicId} />
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
