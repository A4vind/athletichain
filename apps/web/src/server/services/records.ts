/**
 * Records that can be verified: performance results and achievements/milestones.
 * canonicalInputFor() is the ONLY place a record is turned into its canonical form,
 * so approval and the integrity check can never disagree about what was hashed.
 */
import "server-only";
import { generateSalt, hashRecord, type CanonicalInput } from "@athletichain/canonical";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordView {
  id: string;
  publicId: string;
  status: (typeof schema.verifyStatus.enumValues)[number];
  kind: "PERFORMANCE" | "ACHIEVEMENT" | "MILESTONE";
  athleteId: string;
  athleteCode: string;
  athleteName: string;
  athleteUserId: string;
  title: string; // "100m time" or "Tournament winner"
  display: string; // "12.40 s" or "1st"
  event: string | null;
  date: string;
  verifierName: string | null;
  verifierCode: string | null;
  verifierWallet: string | null;
  verifiedAt: string | null;
  canonicalHash: string | null;
  saltHex: string;
  txHash: string | null;
  blockNumber: number | null;
  blockTime: string | null;
  anchorStatus: string | null;
  chainId: number | null;
  contractAddress: string | null;
  lastIntegrityCheckAt: string | null;
  performanceRecordId: string | null;
  achievementId: string | null;
  // canonical fields
  metricCode: string | null;
  value: string | null;
  decimals: number | null;
  unit: string | null;
}

const BASE = sql`
  select vr.id, vr.public_id as "publicId", vr.status,
    case when pr.id is not null then 'PERFORMANCE' else ach.kind::text end as kind,
    a.id as "athleteId", a.public_code as "athleteCode", au.full_name as "athleteName", a.user_id as "athleteUserId",
    coalesce(m.name, ach.title) as title,
    coalesce(case when m.decimals = 0 then to_char(pr.value, 'FM9999990') else to_char(pr.value, 'FM9999990.' || repeat('0', m.decimals)) end || ' ' || m.unit, ach.result) as display,
    coalesce(pr.event_name, ach.event_name) as event,
    to_char(coalesce(pr.recorded_on, ach.achieved_on), 'YYYY-MM-DD') as date,
    cu.full_name as "verifierName", c.public_code as "verifierCode", c.wallet_address as "verifierWallet",
    vr.verified_at as "verifiedAt", encode(vr.canonical_hash, 'hex') as "canonicalHash", encode(vr.salt, 'hex') as "saltHex",
    ba.tx_hash as "txHash", ba.block_number as "blockNumber", ba.block_time as "blockTime", ba.status as "anchorStatus",
    ba.chain_id as "chainId", ba.contract_address as "contractAddress",
    vr.last_integrity_check_at as "lastIntegrityCheckAt",
    vr.performance_record_id as "performanceRecordId", vr.achievement_id as "achievementId",
    m.code as "metricCode", pr.value::text as value, m.decimals, m.unit
  from verifiable_records vr
  left join performance_records pr on pr.id = vr.performance_record_id
  left join sport_metrics m on m.id = pr.metric_id
  left join achievements ach on ach.id = vr.achievement_id
  join athletes a on a.id = coalesce(pr.athlete_id, ach.athlete_id)
  join users au on au.id = a.user_id
  left join coaches c on c.id = vr.verified_by
  left join users cu on cu.id = c.user_id
  left join blockchain_anchors ba on ba.id = vr.current_anchor_id`;

export async function listRecords(where: ReturnType<typeof sql>, limit = 200): Promise<RecordView[]> {
  const res = await db.execute(sql`${BASE} where ${where} order by coalesce(pr.recorded_on, ach.achieved_on) desc, vr.public_id desc limit ${limit}`);
  return res.rows as unknown as RecordView[];
}

export async function getRecordByPublicId(publicId: string) {
  const [r] = await listRecords(sql`vr.public_id = ${publicId}`, 1);
  if (!r) throw new AppError("NOT_FOUND", `Record ${publicId} not found`);
  return r;
}

export async function evidenceHashesFor(recordId: string, tx: Tx | typeof db = db) {
  const rows = await tx.select({ sha: schema.evidenceFiles.sha256 }).from(schema.evidenceFiles).where(eq(schema.evidenceFiles.recordId, recordId));
  return rows.map((r) => r.sha.toString("hex"));
}

/** Canonical input for a record as it stands in the database right now. */
export async function canonicalInputFor(r: RecordView, verifierCode: string, tx: Tx | typeof db = db): Promise<CanonicalInput> {
  const evidenceHashes = await evidenceHashesFor(r.id, tx);
  if (r.kind === "PERFORMANCE") {
    return {
      athleteId: r.athleteCode,
      recordType: "PERFORMANCE",
      metric: r.metricCode!,
      value: Number(r.value),
      decimals: r.decimals ?? 2,
      unit: r.unit!,
      date: r.date,
      verifierId: verifierCode,
      salt: r.saltHex,
      evidenceHashes,
    };
  }
  return {
    athleteId: r.athleteCode,
    recordType: r.kind,
    metric: r.title,
    value: r.display ?? "",
    unit: r.event ?? "",
    date: r.date,
    verifierId: verifierCode,
    salt: r.saltHex,
    evidenceHashes,
  };
}

export async function currentHashOf(r: RecordView, verifierCode: string) {
  return hashRecord(await canonicalInputFor(r, verifierCode));
}

// ---------------------------------------------------------------- creation

async function nextPublicId(tx: Tx, prefix: "PERF" | "ACH" | "MILE", date: string) {
  const res = await tx.execute(sql`select coalesce(max(substring(public_id from '\\d+$')::int), 400) + 1 as n from verifiable_records`);
  const n = (res.rows[0] as { n: number }).n;
  return `${prefix}-${date.slice(0, 4)}-${String(n).padStart(4, "0")}`;
}

/** Creates (or returns) the verifiable record wrapper for a performance record or achievement. */
export async function ensureVerifiable(tx: Tx, subject: { performanceRecordId?: string; achievementId?: string; kind: "PERFORMANCE" | "ACHIEVEMENT" | "MILESTONE"; date: string }) {
  const existing = await tx.query.verifiableRecords.findFirst({
    where: subject.performanceRecordId
      ? eq(schema.verifiableRecords.performanceRecordId, subject.performanceRecordId)
      : eq(schema.verifiableRecords.achievementId, subject.achievementId!),
  });
  if (existing) return existing;
  const prefix = subject.kind === "PERFORMANCE" ? "PERF" : subject.kind === "MILESTONE" ? "MILE" : "ACH";
  const [row] = await tx
    .insert(schema.verifiableRecords)
    .values({
      publicId: await nextPublicId(tx, prefix, subject.date),
      performanceRecordId: subject.performanceRecordId ?? null,
      achievementId: subject.achievementId ?? null,
      salt: Buffer.from(generateSalt(), "hex"),
      status: "DRAFT",
    })
    .returning();
  return row;
}

export const LOCKED_STATUSES = new Set(["PENDING", "VERIFIED", "ANCHORED", "INTEGRITY_WARNING", "SUPERSEDED"]);

export async function assertEditable(performanceRecordId: string) {
  const vr = await db.query.verifiableRecords.findFirst({ where: and(eq(schema.verifiableRecords.performanceRecordId, performanceRecordId)) });
  if (vr && LOCKED_STATUSES.has(vr.status)) {
    throw new AppError("CONFLICT", "This result is under review or verified and can no longer be edited");
  }
}
