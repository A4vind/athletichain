#!/usr/bin/env node
/**
 * One command to run everything locally:  pnpm start:all
 *
 *   1. creates .env (with a random AUTH_SECRET) if it doesn't exist
 *   2. starts a built-in PostgreSQL (no Docker needed), data kept in .data/postgres
 *   3. starts the local Hardhat blockchain on :8545
 *   4. builds the hashing package and compiles the contract (first run only)
 *   5. creates tables, loads demo data on the first run (or every run with --fresh)
 *   6. deploys the contract, registers coach wallets and re-anchors every verified record
 *      (the local chain forgets everything when it stops, your database doesn't)
 *   7. starts the website on http://localhost:3000
 *
 * With CHAIN_NETWORK=sepolia in .env, steps 3 and 6 are replaced by a check of the Sepolia
 * contract and relayer (apps/web/scripts/sepolia-setup.ts); coaches link MetaMask.
 *
 * Ctrl+C stops everything.  `pnpm start:all --fresh` wipes the data and starts over.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRESH = process.argv.includes("--fresh");
const isWin = process.platform === "win32";
const children = [];
let pg = null;

const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, ok: (s) => `\x1b[32m${s}\x1b[0m`, warn: (s) => `\x1b[33m${s}\x1b[0m`, bad: (s) => `\x1b[31m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
const step = (msg) => console.log(`\n${c.bold("▶")} ${msg}`);

// ------------------------------------------------------------------ helpers

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    let text = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    text = text.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${crypto.randomBytes(48).toString("base64url")}`);
    fs.writeFileSync(envPath, text);
    console.log(c.ok("  created .env with a fresh AUTH_SECRET"));
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function run(args, { env, label, quiet } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd: ROOT, env, stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit", shell: isWin });
    let out = "";
    if (quiet) {
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
    }
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`${label ?? args.join(" ")} failed (exit ${code})\n${out}`))));
  });
}

function background(args, env, name) {
  const child = spawn("pnpm", args, { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], shell: isWin });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.env.DEBUG && process.stderr.write(c.dim(`[${name}] ${d}`)));
  children.push(child);
  return child;
}

function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.connect(port, host);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

async function waitFor(fn, what, timeoutMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function rpcReady(url) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
    return res.ok;
  } catch {
    return false;
  }
}

function shutdown(code = 0) {
  console.log(c.dim("\nStopping…"));
  for (const ch of children) {
    try {
      if (isWin) spawn("taskkill", ["/pid", String(ch.pid), "/f", "/t"]);
      else ch.kill("SIGTERM");
    } catch {}
  }
  const done = () => process.exit(code);
  if (pg) pg.stop().then(done, done);
  else done();
}
let stopping = false;
const onSignal = () => { if (!stopping) { stopping = true; shutdown(0); } };
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

// ------------------------------------------------------------------ main

async function main() {
  console.log(c.bold("\nAthletiChain · starting everything\n"));
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) throw new Error(`Node.js 20 or newer is needed (you have ${process.versions.node}). Install it from https://nodejs.org`);
  if (!fs.existsSync(path.join(ROOT, "node_modules"))) throw new Error("Dependencies aren't installed yet. Run: pnpm install");

  const fileEnv = loadEnv();
  const env = { ...process.env, ...fileEnv };

  // --- database
  step("Database");
  const useEmbedded = (fileEnv.EMBEDDED_DB ?? "1") !== "0";
  if (useEmbedded) {
    const port = Number(fileEnv.EMBEDDED_DB_PORT ?? 54329);
    env.DATABASE_URL = `postgres://athletichain:athletichain@localhost:${port}/athletichain`;
    const dataDir = path.join(ROOT, ".data", "postgres");
    if (FRESH && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
    const firstTime = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
    const leftover = fs.existsSync(path.join(dataDir, "postmaster.pid"));
    if (await portOpen(port)) {
      if (!leftover) throw new Error(`Port ${port} is already used by another program. Set EMBEDDED_DB_PORT in .env to a free port.`);
      // Our own database from an earlier run is still up (e.g. the terminal was closed): reuse it.
      console.log(c.warn(`  reusing the database still running from a previous start (port ${port})`));
    } else {
      if (leftover) fs.rmSync(path.join(dataDir, "postmaster.pid"), { force: true }); // stale lock after a crash
      const { default: EmbeddedPostgres } = await import("embedded-postgres");
      pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "athletichain", password: "athletichain", port, persistent: true, onLog: () => {}, onError: (e) => process.env.DEBUG && console.error(c.dim(String(e))) });
      if (firstTime) {
        fs.mkdirSync(dataDir, { recursive: true });
        await pg.initialise();
      }
      await pg.start();
      if (firstTime) await pg.createDatabase("athletichain");
      console.log(c.ok(`  built-in PostgreSQL running on port ${port}`) + c.dim(firstTime ? " (new)" : " (your saved data)"));
    }
  } else {
    console.log(c.dim(`  using DATABASE_URL from .env`));
  }

  // --- blockchain
  const sepolia = (fileEnv.CHAIN_NETWORK ?? "").toLowerCase() === "sepolia";
  if (sepolia) {
    step("Blockchain: Ethereum Sepolia testnet");
    console.log(c.dim("  CHAIN_NETWORK=sepolia in .env, so no local chain is started"));
  } else {
    step("Local blockchain");
    const rpc = env.CHAIN_RPC_URL || "http://127.0.0.1:8545";
    if (await rpcReady(rpc)) {
      console.log(c.warn("  a chain is already running on :8545 — using it"));
    } else {
      background(["--filter", "contracts", "node"], env, "chain");
      await waitFor(() => rpcReady(rpc), "the Hardhat chain to start", 90_000);
      console.log(c.ok("  Hardhat chain running on :8545"));
    }
  }

  // --- build once
  step("Building");
  if (!fs.existsSync(path.join(ROOT, "packages/canonical/dist/index.js"))) {
    await run(["--filter", "@athletichain/canonical", "build"], { env, quiet: true, label: "hashing package build" });
  }
  if (!fs.existsSync(path.join(ROOT, "contracts/artifacts/contracts/AthletiChainRegistry.sol/AthletiChainRegistry.json"))) {
    await run(["--filter", "contracts", "compile"], { env, quiet: true, label: "contract compile" });
  }
  console.log(c.ok("  hashing package and contract ready"));

  // --- schema + data
  step("Tables and data");
  await run(["--filter", "web", "db:migrate"], { env, quiet: true, label: "migrations" });
  const seedOut = await run(["--filter", "web", "db:seed"], { env, quiet: true, label: "seed" });
  console.log(c.ok(seedOut.includes("already seeded") ? "  existing data kept" : "  demo data loaded"));

  // --- anchor on the fresh chain
  step("Blockchain setup");
  const chainOut = await run(["--filter", "web", sepolia ? "chain:sepolia" : "chain:setup"], { env, quiet: true, label: sepolia ? "Sepolia check" : "chain setup" });
  for (const line of chainOut.split("\n")) if (/[✓!]/.test(line)) console.log("  " + line.trim());

  // --- website
  step("Website");
  const web = spawn("pnpm", ["--filter", "web", "dev"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "inherit"], shell: isWin });
  children.push(web);
  let announced = false;
  web.stdout.on("data", (d) => {
    const s = String(d);
    if (process.env.DEBUG) process.stdout.write(c.dim(s));
    if (!announced && /Ready|ready/.test(s)) {
      announced = true;
      console.log(`
${c.ok("  ✓ AthletiChain is running")}

    ${c.bold("Open  http://localhost:3000")}

    Logins (password ${c.bold("Demo@1234")}):
      admin@athletichain.dev     Admin
      anjali@athletichain.dev    Coach
      kabir@athletichain.dev     Coach waiting for approval
      rahul@athletichain.dev     Athlete

    ${c.dim("The first page you open takes ~20 s to compile. Ctrl+C stops everything.")}
`);
    }
  });
  web.on("exit", (code) => {
    if (code) console.error(c.bad(`Website stopped (exit ${code}). Run with DEBUG=1 for details.`));
    shutdown(code ?? 0);
  });
}

main().catch((err) => {
  console.error(c.bad(`\n✗ ${err.message}`));
  if (/initialise|init script/i.test(err.message)) console.error(c.dim("  Tip: delete the .data folder and try again, or run: pnpm start:all --fresh"));
  shutdown(1);
});
