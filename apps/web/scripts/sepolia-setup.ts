/**
 * Prepares the database for the public Sepolia testnet (run by `pnpm start:all` when
 * CHAIN_NETWORK=sepolia, or on its own with `pnpm --filter web chain:sepolia`).
 *
 *   1. checks the RPC really is Sepolia and the relayer owns the deployed contract
 *   2. unlinks Hardhat demo wallets: their private keys are public, so they must never sign on Sepolia
 *   3. local-chain anchors don't exist on Sepolia: those records go back to "coach verified"
 *      so a coach can anchor them again with MetaMask
 *
 * Nothing is deployed or sent here; it only reads the chain and tidies the database.
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import fs from "node:fs";
import path from "node:path";
import { Contract, HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet } from "ethers";
import { Pool } from "pg";

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL is empty in .env (an Alchemy or Infura Sepolia URL)");
  if (!key) throw new Error("RELAYER_PRIVATE_KEY is empty in .env (the private key of a new, testnet-only MetaMask account)");

  const provider = new JsonRpcProvider(rpc);
  const net = await provider.getNetwork().catch(() => {
    throw new Error(`Cannot reach ${rpc}. Check SEPOLIA_RPC_URL.`);
  });
  if (net.chainId !== 11155111n) throw new Error(`SEPOLIA_RPC_URL points at chain ${net.chainId}, not Sepolia (11155111)`);

  let address = process.env.CONTRACT_ADDRESS;
  if (!address) {
    const file = path.resolve("../../contracts/deployments/sepolia.json");
    if (!fs.existsSync(file)) throw new Error("No Sepolia contract yet. Run: pnpm --filter contracts deploy:sepolia");
    address = JSON.parse(fs.readFileSync(file, "utf8")).address as string;
  }
  if ((await provider.getCode(address)) === "0x") throw new Error(`No contract at ${address} on Sepolia`);

  const relayer = new Wallet(key, provider);
  const owner = await new Contract(address, ["function owner() view returns (address)"], provider).owner();
  if (owner.toLowerCase() !== relayer.address.toLowerCase()) {
    throw new Error(`The relayer ${relayer.address} is not the contract owner (${owner}), so it can't register coaches. Deploy with this relayer key.`);
  }
  const balance = Number(await provider.getBalance(relayer.address)) / 1e18;
  console.log(`✓ Sepolia contract ${address}`);
  console.log(`✓ Relayer ${relayer.address} owns it · balance ${balance.toFixed(4)} ETH${balance < 0.01 ? " (low: top it up from a Sepolia faucet)" : ""}`);

  const demo = Array.from({ length: 20 }, (_, i) =>
    HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), `m/44'/60'/0'/0/${i}`).address,
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cleared = await pool.query(`update coaches set wallet_address = null where wallet_address = any($1::text[]) returning public_code`, [demo]);
  if (cleared.rowCount) console.log(`✓ Unlinked demo wallets from ${cleared.rows.map((r) => r.public_code).join(", ")}: each coach links MetaMask on their Blockchain page`);

  await pool.query(`
    update verifiable_records vr set status = 'VERIFIED', current_anchor_id = null
    from blockchain_anchors ba where ba.id = vr.current_anchor_id and ba.chain_id <> 11155111`);
  const removed = await pool.query(`delete from blockchain_anchors where chain_id <> 11155111`);
  if (removed.rowCount) console.log(`✓ ${removed.rowCount} local-chain anchors removed; those records are coach verified and can be anchored again on Sepolia`);
  await pool.end();
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
