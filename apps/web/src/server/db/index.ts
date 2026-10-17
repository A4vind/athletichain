import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example)");

// Reuse one pool across Next.js hot reloads in development. On serverless hosts set PG_POOL_MAX=1-3
// and point DATABASE_URL at a pooled connection (e.g. Neon or Supabase pooler).
const globalForDb = globalThis as unknown as { pgPool?: Pool };
export const pool = globalForDb.pgPool ?? new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 10) });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export { schema };
