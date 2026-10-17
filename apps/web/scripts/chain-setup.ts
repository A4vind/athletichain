/**
 * Local blockchain setup (run after `pnpm chain` is up and the database is seeded):
 *   1. deploys AthletiChainRegistry from the compiled Hardhat artifact
 *   2. gives every approved coach their Hardhat demo wallet and registers it as a verifier
 *   3. anchors every coach-verified seed record with a real, coach-signed transaction
 *
 * Only for the local Hardhat chain (chain id 31337). Nothing here is simulated:
 * every anchor row in the database comes from a mined transaction receipt.
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import fs from "node:fs";
import path from "node:path";
import { hashRecord, type CanonicalInput } from "@athletichain/canonical";
import { ContractFactory, HDNodeWallet, JsonRpcProvider, Mnemonic, NonceManager, Contract, id } from "ethers";
import { Pool } from "pg";

const MNEMONIC = "test test test test test test test test test test test junk";
const RPC = process.env.CHAIN_RPC_URL ?? "http://127.0.0.1:8545";
const wallet = (i: number, p: JsonRpcProvider) => HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(MNEMONIC), `m/44'/60'/0'/0/${i}`).connect(p);

const TYPES = {
  VerifyRecord: [
    { name: "recordKey", type: "bytes32" },
    { name: "recordHash", type: "bytes32" },
    { name: "verifier", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

async function main() {
  const provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true, polling: true, pollingInterval: 200 });
  const net = await provider.getNetwork().catch(() => {
    throw new Error(`No chain at ${RPC}. Start it first with: pnpm chain`);
  });
  if (net.chainId !== 31337n) throw new Error(`Refusing to run: chain id ${net.chainId} is not the local Hardhat chain`);

  // 1. deploy
  const artifactPath = path.resolve("../../contracts/artifacts/contracts/AthletiChainRegistry.sol/AthletiChainRegistry.json");
  if (!fs.existsSync(artifactPath)) throw new Error("Contract not compiled. Run: pnpm --filter contracts compile");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const deployer = new NonceManager(wallet(0, provider));
  const registry = (await new ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy()) as unknown as Contract;
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const outDir = path.resolve("../../contracts/deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "localhost.json"),
    JSON.stringify({ network: "localhost", chainId: 31337, address, deployedAt: new Date().toISOString(), abi: artifact.abi }, null, 2),
  );
  console.log(`✓ AthletiChainRegistry deployed at ${address}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 2. coach wallets + verifier registration
  const coaches = (
    await pool.query(`select c.id, c.public_code from coaches c join users u on u.id = c.user_id where u.status = 'ACTIVE' order by c.public_code`)
  ).rows as { id: string; public_code: string }[];
  const coachWallet = new Map<string, HDNodeWallet>();
  for (const c of coaches) {
    const w = wallet(Number(c.public_code.replace(/\D/g, "")), provider);
    coachWallet.set(c.id, w);
    await pool.query(`update coaches set wallet_address = $1 where id = $2`, [w.address, c.id]);
    await (await registry.registerVerifier(w.address)).wait();
    console.log(`✓ ${c.public_code} wallet ${w.address} registered as verifier`);
  }
  // Wallets of pending coaches are linked when an admin approves them.
  await pool.query(`update coaches c set wallet_address = null from users u where u.id = c.user_id and u.status <> 'ACTIVE'`);
  // Fresh chain: earlier anchors no longer exist on it. Clear pointers first (foreign key), then the rows,
  // and re-anchor every record that is still coach verified.
  await pool.query(`update verifiable_records set current_anchor_id = null, status = 'VERIFIED' where status in ('ANCHORED','INTEGRITY_WARNING')`);
  await pool.query(`delete from blockchain_anchors`);

  // 3. anchor coach-verified seed records
  const records = (
    await pool.query(`
      select vr.id, vr.public_id, encode(vr.salt,'hex') as salt, encode(vr.canonical_hash,'hex') as stored, vr.verified_by,
        c.public_code as verifier_code, a.public_code as athlete_code,
        case when pr.id is not null then 'PERFORMANCE' else ach.kind::text end as kind,
        m.code as metric_code, pr.value::text as value, m.decimals, m.unit,
        ach.title, ach.result, ach.event_name,
        to_char(coalesce(pr.recorded_on, ach.achieved_on), 'YYYY-MM-DD') as date
      from verifiable_records vr
      join coaches c on c.id = vr.verified_by
      left join performance_records pr on pr.id = vr.performance_record_id
      left join sport_metrics m on m.id = pr.metric_id
      left join achievements ach on ach.id = vr.achievement_id
      join athletes a on a.id = coalesce(pr.athlete_id, ach.athlete_id)
      where vr.status = 'VERIFIED' order by vr.public_id`)
  ).rows;

  const domain = { name: "AthletiChain", version: "1", chainId: 31337n, verifyingContract: address };
  let anchored = 0;
  for (const r of records) {
    const signer = coachWallet.get(r.verified_by);
    if (!signer) continue;
    const ev = (await pool.query(`select encode(sha256,'hex') as h from evidence_files where record_id = $1`, [r.id])).rows.map((x) => x.h);
    const input: CanonicalInput =
      r.kind === "PERFORMANCE"
        ? { athleteId: r.athlete_code, recordType: "PERFORMANCE", metric: r.metric_code, value: Number(r.value), decimals: r.decimals, unit: r.unit, date: r.date, verifierId: r.verifier_code, salt: r.salt, evidenceHashes: ev }
        : { athleteId: r.athlete_code, recordType: r.kind, metric: r.title, value: r.result ?? "", unit: r.event_name ?? "", date: r.date, verifierId: r.verifier_code, salt: r.salt, evidenceHashes: ev };
    const hash = hashRecord(input);
    if (hash !== r.stored) {
      // The record was changed after the coach verified it: never re-anchor the changed data.
      await pool.query(`update verifiable_records set status = 'INTEGRITY_WARNING' where id = $1`, [r.id]);
      console.warn(`! ${r.public_id}: changed since verification, kept as integrity warning (not re-anchored)`);
      continue;
    }
    const message = {
      recordKey: id(r.public_id),
      recordHash: `0x${hash}`,
      verifier: signer.address,
      nonce: await registry.nonces(signer.address),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    const sig = await signer.signTypedData(domain, TYPES, message);
    const tx = await registry.verifyRecord(message.recordKey, message.recordHash, message.verifier, message.deadline, sig);
    const receipt = await tx.wait();
    const block = await provider.getBlock(receipt.blockNumber);
    const { rows } = await pool.query(
      `insert into blockchain_anchors (record_id, chain_id, contract_address, record_key, record_hash, verifier_address, tx_hash, block_number, block_time, status)
       values ($1, 31337, $2, decode($3,'hex'), decode($4,'hex'), $5, $6, $7, to_timestamp($8), 'CONFIRMED') returning id`,
      [r.id, address, message.recordKey.slice(2), hash, signer.address, receipt.hash, receipt.blockNumber, block!.timestamp],
    );
    await pool.query(`update verifiable_records set status = 'ANCHORED', current_anchor_id = $1, last_integrity_check_at = now() where id = $2`, [rows[0].id, r.id]);
    anchored++;
  }
  console.log(`✓ Anchored ${anchored} coach-verified records with real transactions`);
  await pool.end();
  provider.destroy();
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
