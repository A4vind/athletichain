import { config } from "dotenv";
config({ path: "../../.env" });

import { Pool } from "pg";

/** Development only: drops every table so migrate + seed start clean. */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  console.log("Database reset.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
