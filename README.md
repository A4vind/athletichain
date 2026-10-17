# AthletiChain

**Blockchain-based athlete performance, progress and achievement verification.**
Track → Verify → Secure → Improve.

All athlete data lives in PostgreSQL. When a coach approves an important record, a salted
SHA-256 fingerprint of it is signed with the coach's wallet and anchored by a smart contract.
If anyone later edits that record in the database, the integrity check catches it.

Everything is connected and working: athlete, coach and admin areas, verification,
real blockchain transactions, integrity checks, QR sharing, disputes and audit log.

---

## Run it (local chain — no MetaMask or test ETH needed)

You need **Node.js 20+**, **pnpm** (`npm i -g pnpm`) and **PostgreSQL 16** (Docker is easiest).

```bash
pnpm install
docker compose up -d                 # Postgres (or use your own and edit DATABASE_URL)
cp .env.example .env                 # then set AUTH_SECRET to a long random string
```

Then use **two terminals**:

```bash
# Terminal 1 — a local Ethereum chain (leave it running)
pnpm chain

# Terminal 2 — build, reset the database, deploy the contract, register coach wallets,
#              anchor the seeded verified records with real transactions, then start the app
pnpm setup:local
pnpm dev                             # http://localhost:3000
```

`pnpm setup:local` prints the contract address, each coach wallet it registered, and
"Anchored 23 coach-verified records with real transactions". Run it again any time to start
fresh. If you restart `pnpm chain`, you must re-run `pnpm setup:local` (the chain forgets
everything when it stops).

### Demo accounts (password `Demo@1234`)

| Role | Email | Notes |
| --- | --- | --- |
| Admin | admin@athletichain.dev | Approves coaches, transfers athletes, demo tools |
| Coach | anjali@athletichain.dev | Rahul's coach; 6 records waiting in her queue |
| Coach | rohan@athletichain.dev | Second athletics coach (verifies Anjali's own entries) |
| Coach | kabir@athletichain.dev | **Pending approval** — step 1 of the demo |
| Athlete | rahul@athletichain.dev | 100m sprinter, the demo athlete |

Other athletes: arjun, sana, isha (under 18, no guardian consent yet), priya, dev, aditya,
kunal, neha, omkar — all `@athletichain.dev`.

---

## The 10-step demo

| # | Who | Do this | You'll see |
| --- | --- | --- | --- |
| 1 | Admin | Dashboard → **Approve** Kabir Malhotra | Kabir becomes active; his wallet is registered on-chain (audit log: *verifier registered*) |
| 2 | Coach Anjali | **My athletes → Rahul Mehta** | Tabs: overview, training, performance, goals, achievements, feedback, verification, blockchain |
| 3 | Rahul *(or skip — already seeded)* | **Performance → Report a result**: 100m, 12.40, attach a PDF | "Sent to your coach for verification" |
| 4 | — | The record is **Pending** in Anjali's queue | Anjali's sidebar shows the count |
| 5 | Coach Anjali | **Verifications → Approve & anchor on-chain** on Rahul's 100m 12.40 s | Progress: Coach approved → Hash generated → Signed by coach wallet → Transaction confirmed |
| 6 | — | The canonical record and its SHA-256 are shown before you approve | `{"athleteId":"ATH-0007",…}` → `0x…` |
| 7 | — | The relayer sends `verifyRecord(...)` with Anjali's EIP-712 signature | Block number appears |
| 8 | — | **Open record →** | Transaction hash, block, contract, verifier wallet |
| 9 | Rahul | **Profile** | `100m time · 12.40 s` ⬡ **Blockchain anchored**. Open it → **Run integrity check** → ✓ *Record matches blockchain proof* |
| 10 | Admin | **Blockchain → Demo tools**: change PERF-2026-0403 to **12.10** | Rahul's record → **Run integrity check** → ⚠ **Blockchain integrity mismatch**. The record is flagged everywhere; admin gets a notification. **Restore original value** → ✓ again |

Extras worth showing: **Verified profile** (Rahul) → create a QR → open it on a phone
(public page, first name + initial only, live check); reject a record as a coach → the
athlete **raises a dispute** → admin **upholds** it → back in the coach's queue.

---

## What each role can do

**Athlete** — dashboard with trend and consistency charts; profile with personal bests and
verified records; training history; report results and achievements with evidence (PDF/image,
fingerprinted into the hash); goals with direction-aware progress; verification status and
live integrity checks; disputes; share links and QR codes with expiry and revoke (blocked for
under-18s until guardian consent); change password.

**Coach** — dashboard; athletes with 8-tab detail pages and a rule-based insight; log training
sessions with attendance; enter results, achievements, goals and feedback; verification queue
showing exactly what will be signed; approve (hash → sign → anchor) or reject with a reason;
blockchain page with wallet status and every record they verified.
A coach can never verify their own entry: it goes to another coach at the same academy.

**Admin** — dashboard; coach approvals (auto-registers the coach's wallet on-chain);
users and suspension (suspending a coach revokes them on-chain; their old proofs stay valid);
athletes with coach/team transfers and guardian consent; academies and teams; sports and
metrics; all verification requests; disputes; blockchain status, check-all and demo tools;
filterable audit log.

**Public** — landing page, `/verify/VR-XXXXXXXXXX` from a QR or the landing-page search box.

---

## How the verification works

1. **Canonical record** (`packages/canonical`): a flat JSON object with sorted keys and string
   values — athlete code, date, the evidence files' SHA-256 values, metric, record type,
   a secret 8-byte **salt**, schema version, unit, value (fixed decimals), verifier code.
2. **SHA-256** of that JSON is the record hash. The salt stops anyone guessing a time from the
   public hash; the evidence hashes mean swapping a file is caught too.
3. The coach signs `VerifyRecord(recordKey, recordHash, verifier, nonce, deadline)` (EIP-712).
   On the local chain the app signs with the coach's Hardhat test wallet; on Sepolia, MetaMask
   asks the coach.
4. The relayer submits `verifyRecord(...)`. The contract recovers the signer, checks the coach is
   an **active registered verifier**, refuses to overwrite, and stores hash + verifier + time.
5. **Integrity check**: rebuild → hash → `getRecord()` → compare hash *and* verifier wallet.

Only hashes, keccak record keys and addresses go on-chain. Never names, values, files or salts.

---

## Sepolia (public testnet)

1. Create a **new** MetaMask account for the relayer, fund it from a Sepolia faucet.
2. In `.env`: `CHAIN_NETWORK=sepolia`, `SEPOLIA_RPC_URL=<Alchemy/Infura URL>`,
   `RELAYER_PRIVATE_KEY=<that account's key>`.
3. `pnpm --filter contracts deploy:sepolia` → writes `contracts/deployments/sepolia.json`.
4. Each coach opens **Blockchain → Link MetaMask wallet**; the relayer registers them.
5. Approving now opens MetaMask to sign; transaction links go to Sepolia Etherscan.

Fund the relayer a week before your viva, and keep the local chain as a fallback.

---

## Tests

```bash
pnpm test     # 12 hashing + 10 contract + 6 validation tests
```

The golden hashes in `packages/canonical/test` match the architecture document:
`12.40 s` → `1ca14114…cd0e1009`, tampered `12.10 s` → `122b184a…1581036b`.

## Project layout

```
apps/web/
  src/app/                 public, (auth), athlete/, coach/, admin/, (app)/records + notifications, api/
  src/server/blockchain/   chain.ts — the only code that talks to the chain or holds the relayer key
  src/server/services/     auth, verification, records, activities, sharing, evidence, admin, queries
  src/server/db/           Drizzle schema, migrations, seed
  scripts/chain-setup.ts   deploy + register verifiers + anchor seed records (local chain only)
packages/canonical/        canonical record + hashing + goal progress
contracts/                 AthletiChainRegistry.sol + Hardhat tests
```

## Security summary

argon2id passwords · httpOnly JWT session · role checks in middleware **and** every server
action · login and public-verify rate limits · separation of duties enforced by a database
constraint · anchored records can't be edited through the app · evidence served only to
people allowed to see the record · relayer key only on the server · audit log for every
important action · demo tools off in production unless `DEMO_TOOLS=1`.

## Changes from the architecture document

| Planned | Built | Why |
| --- | --- | --- |
| Prisma | Drizzle ORM | No engine binaries to download; installs on restricted networks |
| Auth.js | Own JWT session (jose) + argon2id | Fewer moving parts, fully explainable |
| Tailwind + shadcn/ui | Hand-written CSS design system | Matches the AthletiChain design directly |
| MinIO/S3 for evidence | Local disk (`STORAGE_DIR`) | Enough for a single-server project |
| `verifyRecord(key, hash, deadline, sig)` | adds `verifier` | permit-style: the contract checks nonce and signer in one step |
