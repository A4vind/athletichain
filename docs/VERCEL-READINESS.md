# Vercel readiness

Status on 17 Oct 2026: **ready to deploy** with Neon and Vercel Blob. Follow
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) step by step.

| Area | Local | On Vercel | Status |
| --- | --- | --- | --- |
| PostgreSQL | `embedded-postgres` on port 54329 | Neon pooled URL, `PG_POOL_MAX=2`; migrations run from your Mac | Done (`server/db/index.ts` reads `PG_POOL_MAX`) |
| Evidence uploads | Files under `STORAGE_DIR` | Private Vercel Blob store when `BLOB_READ_WRITE_TOKEN` is set; keys saved as `blob:evidence/...` | Done (`server/services/evidence.ts`) |
| Upload size | Was 10 MB on paper, but server actions stopped at 1 MB | Vercel accepts bodies up to 4.5 MB | Limit is now 4 MB everywhere, checked in the browser and on the server |
| Blockchain | Hardhat node and demo wallets | Off by default: approvals stay "Coach verified" with a clear message. Sepolia needs four variables. | Done (`chainConfigured()` in `server/blockchain/chain.ts`) |
| Contract address | `contracts/deployments/<network>.json` | Set `CONTRACT_ADDRESS` (Sepolia only) | Documented |
| Long requests | No limit | `maxDuration = 60` in the athlete, coach, admin and shared layouts; 30 on `/verify/[code]` | Done |
| Monorepo build | `start:all` builds the hashing package | `apps/web` `build` script builds `@athletichain/canonical` first | Done |

## Smaller items

- **Rate limiting** is in memory (`server/lib/rate-limit.ts`). On Vercel each instance has its
  own counter, so limits are weaker. Use Upstash Redis or Vercel KV if this matters.
- **Environment variables**: `AUTH_SECRET` (32+ characters), `APP_URL` (the public URL used
  in QR codes), `DEMO_TOOLS=1` only for a demo deployment (it shows one-click demo logins with a known password).
- **Monorepo**: set the project root to `apps/web` and keep the default build command.
- **`next.config.ts`** loads `../../.env` with dotenv. On Vercel the file does not exist and
  the call does nothing, so it is safe to keep.
- **Fonts** are self-hosted through `@fontsource` packages, so no request goes to Google Fonts.
- **Background jobs**: none. Nothing needs a cron job today.
