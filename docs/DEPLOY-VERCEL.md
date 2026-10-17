# Deploy AthletiChain on Vercel with Neon

This puts the web app online with:

- **Neon** for the PostgreSQL database
- **Vercel Blob** (private store) for evidence files
- **Vercel** for the Next.js app

The blockchain is optional. Without it, everything works, and approved records show as
**Coach verified** instead of **Blockchain anchored**. Sepolia can be added later (section 6).

> **Never paste secrets into chat, screenshots or GitHub.** Secrets here are the database
> connection string, `AUTH_SECRET`, the Blob token and any private key. Type them only into
> your own Terminal or the Vercel dashboard.

---

## 1. Create the Neon database

1. Go to **neon.tech** and sign in (GitHub login is fine).
2. Click **New project**:
   - Name: `athletichain`
   - Postgres version: 17
   - Region: the one closest to your users, for example **AWS Asia Pacific (Singapore)**.
     Remember it; Vercel should use the same region (step 5.4).
3. Open the project and click **Connect**. You need two connection strings:
   - **Direct**: turn *Connection pooling* **off** and copy the string. Use it for steps 2
     and 3 (migrations and seed).
   - **Pooled**: turn *Connection pooling* **on** and copy the string. Its host contains
     `-pooler`. Use it in Vercel (step 5).

   Both look like `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`.

## 2. Create the tables (run on your Mac)

In Terminal, from the project folder:

```bash
cd "/Users/dineshry03/Documents/Documents - Dinesh’s MacBook Air/Developer/b project/athletichain"
pnpm install
pnpm --filter @athletichain/canonical build
DATABASE_URL='PASTE-DIRECT-STRING-HERE' pnpm --filter web db:migrate
```

Keep the single quotes. The string contains `?` and `&`, which the shell would otherwise
break apart. You should see `Migrations applied.`

## 3. Load the demo data (optional, recommended for a project demo)

```bash
DATABASE_URL='PASTE-DIRECT-STRING-HERE' pnpm --filter web db:seed
```

This creates the demo academy, coaches and athletes. Every demo login uses the password
`Demo@1234`. Skip this step if you want an empty app and will register real users.

Check the data in Neon: **Tables** in the left sidebar should list `users`, `athletes`,
`verifiable_records` and others, with rows in them.

## 4. Push the code to GitHub

`.env`, `node_modules`, `.data` and `storage` are already in `.gitignore`, so no secrets
go up.

```bash
git status                    # .env must NOT appear in the list
git add -A
git commit -m "Vercel + Neon deployment support"
git push
```

If the repository is not on GitHub yet: create an empty **private** repository on
github.com (no README), then run the commands GitHub shows under
*"…or push an existing repository from the command line"*.

## 5. Create the Vercel project

1. Go to **vercel.com**, sign in with GitHub, click **Add New → Project** and import the
   repository.
2. On the configure screen:
   - **Root Directory**: click *Edit* and choose `apps/web`
   - **Framework Preset**: Next.js (detected)
   - Build, Output and Install commands: leave as default. `pnpm build` in `apps/web` builds
     the hashing package first, then Next.js.
3. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the **pooled** Neon string (host contains `-pooler`) |
   | `PG_POOL_MAX` | `2` |
   | `AUTH_SECRET` | a new random value: run `openssl rand -base64 48` in Terminal and paste the output |
   | `DEMO_TOOLS` | `1` only for a demo (shows the one-click demo logins and tamper demo); leave it out for real users |

   Don't add `CHAIN_NETWORK` yet; see section 6.
4. Click **Deploy** and wait about two minutes.
5. **Match the region**: Project → **Settings → Functions → Function Region**. Pick the
   region nearest your Neon database (Singapore = `sin1`), save, then redeploy.

### 5.1 Add evidence storage (Vercel Blob)

1. Project → **Storage** → **Create** → **Blob**. Name it `athletichain-evidence`. If it asks
   for an access type, choose **Private**.
2. Connect it to the project for **Production** and **Preview**. Vercel adds
   `BLOB_READ_WRITE_TOKEN` to the environment variables for you.

### 5.2 Set the public URL

1. Copy the production address, for example `https://athletichain.vercel.app`.
2. Add the environment variable `APP_URL` with that value. QR codes and share links use it.
3. **Deployments** → the latest one → **⋯ → Redeploy**. Environment variable changes only
   apply after a redeploy.

## 6. Optional: connect the blockchain (Sepolia)

Do this after the Sepolia setup works on your Mac. That means the relayer wallet has test
ETH and `pnpm --filter contracts deploy:sepolia` printed a contract address. Then add these
variables in Vercel and redeploy:

| Name | Value |
| --- | --- |
| `CHAIN_NETWORK` | `sepolia` |
| `SEPOLIA_RPC_URL` | your Alchemy **Sepolia** URL (starts `https://eth-sepolia.`) |
| `RELAYER_PRIVATE_KEY` | the test-only relayer key, starting with `0x` |
| `CONTRACT_ADDRESS` | the deployed contract address |

Coaches then link MetaMask on Sepolia and sign each approval in the browser.

## 7. Test the live site

1. Open the site → **Log in** → **Athlete** demo card.
2. **Performance** → report a result and attach a small PDF or photo, up to 4 MB.
3. Log out → log in as **Coach** → **Verifications** → open the record → open the evidence
   file → approve. Without Sepolia it shows *Coach verified*.
4. Log in as the athlete → **Sharing** → create a share code → open `/verify/<code>` in a
   private window.

## What runs where

| Piece | Local (`pnpm start:all`) | Vercel |
| --- | --- | --- |
| Database | built-in PostgreSQL on port 54329 | Neon (pooled connection, 2 per function) |
| Evidence files | `apps/web/storage/` on disk | private Vercel Blob store |
| Blockchain | Hardhat node, demo coach wallets | off, or Sepolia with MetaMask |
| Slow pages | no limit | up to 60 s (`maxDuration` in the role layouts) |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with `Cannot find module '@athletichain/canonical'` | Root Directory must be `apps/web`, and **Include files outside the root directory** (Settings → Build) must be on. |
| Every page shows an error after login | `AUTH_SECRET` or `DATABASE_URL` is missing. Add it, then redeploy. |
| `relation "users" does not exist` | Step 2 was skipped or ran against a different database. |
| Evidence upload fails | The Blob store isn't connected to this environment (step 5.1). Redeploy after connecting. |
| Too many connections | Make sure `DATABASE_URL` is the `-pooler` string and `PG_POOL_MAX` is `2`. |
| QR codes point to localhost | Set `APP_URL` (step 5.2) and redeploy. |
