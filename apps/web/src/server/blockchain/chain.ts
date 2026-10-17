/**
 * The only module that talks to the blockchain or holds the relayer key.
 * Never import this from client components.
 *
 * Networks
 *  - localhost (Hardhat, chain id 31337): each approved coach gets a deterministic
 *    demo wallet derived from Hardhat's public test mnemonic, so the full flow works
 *    without MetaMask. These keys are public test keys and are refused on any other chain.
 *  - sepolia: coaches link MetaMask and sign the EIP-712 approval in the browser.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Contract, HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet, id, verifyTypedData, type TypedDataField } from "ethers";

export const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function registerVerifier(address v)",
  "function revokeVerifier(address v)",
  "function verifyRecord(bytes32 recordKey, bytes32 recordHash, address verifier, uint256 deadline, bytes sig)",
  "function supersedeRecord(bytes32 oldKey, bytes32 newKey, bytes32 newHash, address verifier, uint256 deadline, bytes sig)",
  "function getRecord(bytes32 recordKey) view returns (tuple(bytes32 recordHash, address verifier, uint64 timestamp, uint8 status, bytes32 supersededBy))",
  "function isRecordVerified(bytes32 recordKey, bytes32 recordHash) view returns (bool)",
  "function nonces(address) view returns (uint256)",
  "function verifiers(address) view returns (uint64 activeFrom, uint64 activeUntil, bool exists)",
  "function wasVerifierActive(address v, uint64 at) view returns (bool)",
  "event RecordVerified(bytes32 indexed recordKey, bytes32 recordHash, address indexed verifier)",
] as const;

export const VERIFY_TYPES: Record<string, TypedDataField[]> = {
  VerifyRecord: [
    { name: "recordKey", type: "bytes32" },
    { name: "recordHash", type: "bytes32" },
    { name: "verifier", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";
const HARDHAT_CHAIN_ID = 31337n;

export type ChainNetwork = "localhost" | "sepolia";

export function chainNetwork(): ChainNetwork {
  return process.env.CHAIN_NETWORK === "sepolia" ? "sepolia" : "localhost";
}

/**
 * False on a hosted deployment (Vercel) that has no chain set up yet: there is no local
 * Hardhat node there. The app still works; approved records stay "coach verified".
 */
export function chainConfigured() {
  if (chainNetwork() === "sepolia") return Boolean(process.env.SEPOLIA_RPC_URL);
  return !process.env.VERCEL || Boolean(process.env.CHAIN_RPC_URL);
}

export const CHAIN_OFF_MESSAGE =
  "Blockchain is not connected on this deployment, so approved records stay coach verified. Set CHAIN_NETWORK=sepolia to anchor them.";

export function rpcUrl() {
  return chainNetwork() === "sepolia" ? process.env.SEPOLIA_RPC_URL ?? "" : process.env.CHAIN_RPC_URL ?? "http://127.0.0.1:8545";
}

export function explorerTxUrl(txHash: string): string | null {
  return chainNetwork() === "sepolia" ? `https://sepolia.etherscan.io/tx/${txHash}` : null;
}

export function explorerName() {
  return chainNetwork() === "sepolia" ? "Sepolia Etherscan" : "Local Hardhat chain";
}

/** Address from CONTRACT_ADDRESS, else from contracts/deployments/<network>.json written by the setup script. */
export function contractAddress(): string | null {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const file = path.resolve(process.cwd(), "../../contracts/deployments", `${chainNetwork()}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")).address as string;
  } catch {
    return null;
  }
}

let providerCache: JsonRpcProvider | null = null;
export function provider() {
  providerCache ??= new JsonRpcProvider(rpcUrl(), undefined, { staticNetwork: true, polling: true, pollingInterval: 500 });
  return providerCache;
}

export function relayer() {
  const key =
    process.env.RELAYER_PRIVATE_KEY ||
    (chainNetwork() === "localhost" ? HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), "m/44'/60'/0'/0/0").privateKey : "");
  if (!key) throw new Error("RELAYER_PRIVATE_KEY is not set");
  return new Wallet(key, provider());
}

export function registry(signer?: Wallet) {
  const address = contractAddress();
  if (!address) throw new Error("No contract deployed. Run `pnpm setup:local` (or set CONTRACT_ADDRESS).");
  return new Contract(address, REGISTRY_ABI, signer ?? provider());
}

export async function chainStatus() {
  const address = contractAddress();
  if (!chainConfigured()) {
    return { ok: false, network: chainNetwork(), chainId: null, block: null, contract: address, relayer: null, relayerBalanceEth: null, error: CHAIN_OFF_MESSAGE };
  }
  try {
    const p = provider();
    const [network, block] = await Promise.all([p.getNetwork(), p.getBlockNumber()]);
    const code = address ? await p.getCode(address) : "0x";
    const relay = relayer();
    const balance = await p.getBalance(relay.address);
    return {
      ok: code !== "0x",
      network: chainNetwork(),
      chainId: Number(network.chainId),
      block,
      contract: address,
      relayer: relay.address,
      relayerBalanceEth: Number(balance) / 1e18,
      error: code === "0x" ? "Contract not found at this address (redeploy with `pnpm setup:local`)" : null,
    };
  } catch {
    return { ok: false, network: chainNetwork(), chainId: null, block: null, contract: address, relayer: null, relayerBalanceEth: null, error: `Cannot reach the chain at ${rpcUrl()} — is \`pnpm chain\` running?` };
  }
}

export const recordKeyOf = (publicId: string) => id(publicId);
export const toBytes32 = (hex: string) => (hex.startsWith("0x") ? hex : `0x${hex}`);

export async function domain() {
  const net = await provider().getNetwork();
  return { name: "AthletiChain", version: "1", chainId: net.chainId, verifyingContract: registry().target as string };
}

/** Typed data the coach signs. Returned to the browser for MetaMask, or signed by the demo wallet. */
export async function buildVerifyTypedData(publicId: string, recordHashHex: string, verifier: string) {
  const nonce: bigint = await registry().nonces(verifier);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
  return {
    domain: await domain(),
    types: VERIFY_TYPES,
    message: { recordKey: recordKeyOf(publicId), recordHash: toBytes32(recordHashHex), verifier, nonce, deadline },
  };
}

// ---------------------------------------------------------------- demo wallets

async function isLocalChain() {
  return chainNetwork() === "localhost" && (await provider().getNetwork()).chainId === HARDHAT_CHAIN_ID;
}

/** Hardhat test account #n for coach COA-000n. Refused unless the chain really is a local Hardhat node. */
export async function demoWalletForCoach(publicCode: string) {
  if (!(await isLocalChain())) throw new Error("Demo wallets exist only on the local Hardhat chain. Link MetaMask instead.");
  const n = Number(publicCode.replace(/\D/g, ""));
  if (!Number.isInteger(n) || n < 1 || n > 19) throw new Error(`No demo wallet for ${publicCode}`);
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), `m/44'/60'/0'/0/${n}`);
}

export function supportsDemoSigning() {
  return chainNetwork() === "localhost";
}

export function checkTypedSignature(typed: Awaited<ReturnType<typeof buildVerifyTypedData>>, signature: string) {
  return verifyTypedData(typed.domain, typed.types, typed.message, signature);
}

// ---------------------------------------------------------------- writes

export async function registerVerifierOnChain(address: string) {
  const reg = registry(relayer());
  const info = await reg.verifiers(address);
  if (info.exists && info.activeUntil === 0n) return null; // already active
  const tx = await reg.registerVerifier(address);
  const receipt = await tx.wait(1);
  return receipt?.hash ?? tx.hash;
}

export async function revokeVerifierOnChain(address: string) {
  const reg = registry(relayer());
  const info = await reg.verifiers(address);
  if (!info.exists || info.activeUntil !== 0n) return null;
  const tx = await reg.revokeVerifier(address);
  const receipt = await tx.wait(1);
  return receipt?.hash ?? tx.hash;
}

export async function submitVerification(
  typed: Awaited<ReturnType<typeof buildVerifyTypedData>>,
  signature: string,
) {
  const reg = registry(relayer());
  const { recordKey, recordHash, verifier, deadline } = typed.message;
  const tx = await reg.verifyRecord(recordKey, recordHash, verifier, deadline, signature);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("Transaction failed");
  const block = await provider().getBlock(receipt.blockNumber);
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockTime: new Date(Number(block?.timestamp ?? 0) * 1000) };
}

export async function readRecord(publicId: string) {
  const r = await registry().getRecord(recordKeyOf(publicId));
  return {
    recordHash: (r.recordHash as string).toLowerCase(),
    verifier: r.verifier as string,
    timestamp: Number(r.timestamp),
    status: Number(r.status) as 0 | 1 | 2,
  };
}
