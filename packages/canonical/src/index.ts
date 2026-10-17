/**
 * Canonical record hashing for AthletiChain.
 *
 * The server, the tests and any later verifier must all produce byte-identical
 * canonical JSON for the same record, otherwise the integrity check fails on
 * untouched data. Every rule lives here and nowhere else.
 *
 * Rules (Phase 1 architecture, section I):
 *  1. Flat object with exactly the CANONICAL_KEYS below.
 *  2. Every value is a string. Numbers use the metric's fixed decimals
 *     (12.4 -> "12.40"); dates are YYYY-MM-DD.
 *  3. Keys sorted alphabetically, JSON without whitespace, UTF-8, SHA-256.
 */
import { createHash, randomBytes } from "node:crypto";

export const SCHEMA_VERSION = 1;

export type RecordType = "PERFORMANCE" | "ACHIEVEMENT" | "MILESTONE";

export interface CanonicalInput {
  /** Public athlete code, e.g. ATH-0007 (never the database UUID). */
  athleteId: string;
  recordType: RecordType;
  /** Metric code for performance records; achievement title otherwise. */
  metric: string;
  /** Numeric value for performance records; result text otherwise (e.g. "1st"). */
  value: number | string;
  /** Decimals used to format numeric values. Ignored for string values. */
  decimals?: number;
  /** Unit for performance records; event name or "" otherwise. */
  unit: string;
  /** Date of the result, as Date or YYYY-MM-DD. */
  date: Date | string;
  /** Public verifier code, e.g. COA-0002. */
  verifierId: string;
  /** Hex salt stored with the record (never published). */
  salt: string;
  /** SHA-256 hex digests of each evidence file (any order). */
  evidenceHashes: string[];
  schemaVersion?: number;
}

export const CANONICAL_KEYS = [
  "athleteId",
  "date",
  "evidenceHash",
  "metric",
  "recordType",
  "salt",
  "schemaVersion",
  "unit",
  "value",
  "verifierId",
] as const;

export type CanonicalRecord = Record<(typeof CANONICAL_KEYS)[number], string>;

const HEX = /^[0-9a-f]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatValue(value: number | string, decimals = 2): string {
  if (typeof value === "string") return value.trim();
  if (!Number.isFinite(value)) throw new Error("value must be a finite number");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new Error("decimals must be an integer between 0 and 6");
  }
  return value.toFixed(decimals);
}

export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    if (!DATE.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${date}`);
    return date;
  }
  // Use UTC parts so the result never shifts with the server's timezone.
  return date.toISOString().slice(0, 10);
}

export function combineEvidenceHashes(hashes: string[]): string {
  const clean = hashes.map((h) => h.toLowerCase().replace(/^0x/, ""));
  for (const h of clean) {
    if (h.length !== 64 || !HEX.test(h)) throw new Error(`invalid evidence hash: ${h}`);
  }
  return [...clean].sort().join(",");
}

export function buildCanonical(input: CanonicalInput): CanonicalRecord {
  const salt = input.salt.toLowerCase().replace(/^0x/, "");
  if (salt.length < 16 || !HEX.test(salt)) throw new Error("salt must be at least 8 bytes of hex");
  return {
    athleteId: input.athleteId,
    date: formatDate(input.date),
    evidenceHash: combineEvidenceHashes(input.evidenceHashes),
    metric: input.metric,
    recordType: input.recordType,
    salt,
    schemaVersion: String(input.schemaVersion ?? SCHEMA_VERSION),
    unit: input.unit,
    value: formatValue(input.value, input.decimals),
    verifierId: input.verifierId,
  };
}

export function canonicalJson(record: CanonicalRecord): string {
  const sorted: Record<string, string> = {};
  for (const key of [...CANONICAL_KEYS].sort()) sorted[key] = record[key];
  return JSON.stringify(sorted);
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Returns the 32-byte record hash as lowercase hex without 0x. */
export function hashRecord(input: CanonicalInput): string {
  return sha256Hex(canonicalJson(buildCanonical(input)));
}

export function generateSalt(bytes = 8): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Goal progress that works for both directions.
 * The start and target already encode the direction, so
 * (start - current) / (start - target) is right for times and for runs.
 * Returns 0..100, rounded to one decimal.
 */
export function goalProgress(start: number, current: number, target: number): number {
  if (start === target) throw new Error("start and target must differ");
  const raw = (start - current) / (start - target);
  const clamped = Math.min(1, Math.max(0, raw));
  return Math.round(clamped * 1000) / 10;
}

export function isImprovement(
  previous: number,
  next: number,
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER",
): boolean {
  return direction === "LOWER_IS_BETTER" ? next < previous : next > previous;
}
