/**
 * AthletiChain database schema (Phase 1 architecture, section E).
 * PostgreSQL holds every full record; the chain only ever sees hashes.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ------------------------------------------------------------------ enums
export const userRole = pgEnum("user_role", ["ATHLETE", "COACH", "ADMIN"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "PENDING_APPROVAL", "SUSPENDED"]);
export const metricDirection = pgEnum("metric_direction", ["LOWER_IS_BETTER", "HIGHER_IS_BETTER"]);
export const recordSource = pgEnum("record_source", ["SELF_REPORTED", "COACH_ENTERED"]);
export const verifyStatus = pgEnum("verify_status", [
  "DRAFT",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "ANCHORED",
  "SUPERSEDED",
  "INTEGRITY_WARNING",
]);
export const anchorStatus = pgEnum("anchor_status", ["SUBMITTED", "CONFIRMED", "FAILED"]);
export const achievementKind = pgEnum("achievement_kind", ["ACHIEVEMENT", "MILESTONE"]);
export const goalStatus = pgEnum("goal_status", ["ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"]);

// ------------------------------------------------- identity and organisation
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lower-case
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  status: userStatus("status").notNull().default("ACTIVE"),
  fullName: text("full_name").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ...timestamps,
});

export const academies = pgTable("academies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  city: text("city"),
  adminUserId: uuid("admin_user_id").references(() => users.id),
  ...timestamps,
});

export const sports = pgTable("sports", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** Fully built in the MVP (Athletics, Cricket) vs metric definitions only. */
  isFullyBuilt: boolean("is_fully_built").notNull().default(false),
  ...timestamps,
});

export const sportMetrics = pgTable(
  "sport_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sportId: uuid("sport_id").notNull().references(() => sports.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    direction: metricDirection("direction").notNull(),
    decimals: smallint("decimals").notNull().default(2),
    isAnchorable: boolean("is_anchorable").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("sport_metric_code").on(t.sportId, t.code)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academyId: uuid("academy_id").notNull().references(() => academies.id),
    sportId: uuid("sport_id").notNull().references(() => sports.id),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("team_name_per_academy").on(t.academyId, t.name)],
);

// ------------------------------------------------------------------ people
export const coaches = pgTable("coaches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  academyId: uuid("academy_id").references(() => academies.id),
  sportId: uuid("sport_id").references(() => sports.id),
  publicCode: text("public_code").notNull().unique(), // COA-0002
  walletAddress: varchar("wallet_address", { length: 42 }).unique(),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...timestamps,
});

export const athletes = pgTable("athletes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  publicCode: text("public_code").notNull().unique(), // ATH-0007
  sportId: uuid("sport_id").notNull().references(() => sports.id),
  position: text("position"),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  photoUrl: text("photo_url"),
  bio: text("bio"),
  guardianName: text("guardian_name"),
  guardianEmail: text("guardian_email"),
  guardianConsentAt: timestamp("guardian_consent_at", { withTimezone: true }),
  ...timestamps,
});

export const coachAssignments = pgTable(
  "coach_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: uuid("coach_id").notNull().references(() => coaches.id),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    ...timestamps,
  },
  (t) => [
    check("assignment_dates", sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
    uniqueIndex("one_active_coach").on(t.athleteId).where(sql`${t.endDate} IS NULL`),
    index("assign_coach").on(t.coachId),
  ],
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("one_active_team").on(t.athleteId).where(sql`${t.endDate} IS NULL`)],
);

// ------------------------------------------------------- training and results
export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: uuid("coach_id").notNull().references(() => coaches.id),
    teamId: uuid("team_id").references(() => teams.id),
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    type: text("type").notNull(),
    durationMin: smallint("duration_min").notNull(),
    intensity: text("intensity").notNull(),
    exercises: text("exercises"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    check("duration_positive", sql`${t.durationMin} > 0`),
    check("intensity_value", sql`${t.intensity} IN ('LOW','MEDIUM','HIGH')`),
    index("session_coach_date").on(t.coachId, t.sessionDate),
  ],
);

export const sessionAttendance = pgTable(
  "session_attendance",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    status: text("status").notNull(),
    observation: text("observation"),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.athleteId] }),
    check("attendance_value", sql`${t.status} IN ('PRESENT','ABSENT','EXCUSED')`),
  ],
);

export const performanceRecords = pgTable(
  "performance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    metricId: uuid("metric_id").notNull().references(() => sportMetrics.id),
    eventName: text("event_name"),
    value: numeric("value", { precision: 12, scale: 3 }).notNull(),
    recordedOn: date("recorded_on", { mode: "string" }).notNull(),
    conditions: text("conditions"),
    notes: text("notes"),
    source: recordSource("source").notNull(),
    enteredBy: uuid("entered_by").notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [index("perf_athlete_metric_date").on(t.athleteId, t.metricId, t.recordedOn)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    kind: achievementKind("kind").notNull(),
    title: text("title").notNull(),
    eventName: text("event_name"),
    result: text("result"),
    achievedOn: date("achieved_on", { mode: "string" }).notNull(),
    description: text("description"),
    enteredBy: uuid("entered_by").notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [index("achievement_athlete").on(t.athleteId)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    metricId: uuid("metric_id").notNull().references(() => sportMetrics.id),
    setBy: uuid("set_by").notNull().references(() => coaches.id),
    title: text("title").notNull(),
    startValue: numeric("start_value", { precision: 12, scale: 3 }).notNull(),
    targetValue: numeric("target_value", { precision: 12, scale: 3 }).notNull(),
    deadline: date("deadline", { mode: "string" }).notNull(),
    status: goalStatus("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [check("goal_has_direction", sql`${t.startValue} <> ${t.targetValue}`), index("goal_athlete").on(t.athleteId)],
);

export const coachFeedback = pgTable("coach_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
  coachId: uuid("coach_id").notNull().references(() => coaches.id),
  body: text("body").notNull(),
  relatedSession: uuid("related_session").references(() => trainingSessions.id),
  ...timestamps,
});

// ------------------------------------------------- verification and blockchain
export const verifiableRecords = pgTable(
  "verifiable_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(), // PERF-2026-0418
    performanceRecordId: uuid("performance_record_id")
      .unique()
      .references(() => performanceRecords.id),
    achievementId: uuid("achievement_id")
      .unique()
      .references(() => achievements.id),
    salt: bytea("salt").notNull(),
    schemaVersion: smallint("schema_version").notNull().default(1),
    status: verifyStatus("status").notNull().default("DRAFT"),
    verifiedBy: uuid("verified_by").references(() => coaches.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    canonicalHash: bytea("canonical_hash"),
    currentAnchorId: uuid("current_anchor_id").references((): AnyPgColumn => blockchainAnchors.id),
    lastIntegrityCheckAt: timestamp("last_integrity_check_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("salt_length", sql`octet_length(${t.salt}) = 8`),
    check("hash_length", sql`${t.canonicalHash} IS NULL OR octet_length(${t.canonicalHash}) = 32`),
    check("exactly_one_subject", sql`num_nonnulls(${t.performanceRecordId}, ${t.achievementId}) = 1`),
    index("vrec_status").on(t.status),
  ],
);

export const evidenceFiles = pgTable("evidence_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id")
    .notNull()
    .references(() => verifiableRecords.id),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: bytea("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  ...timestamps,
});

export const verificationRequests = pgTable(
  "verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => verifiableRecords.id),
    submittedBy: uuid("submitted_by").notNull().references(() => users.id),
    assignedCoach: uuid("assigned_coach").notNull().references(() => coaches.id),
    reviewedByUser: uuid("reviewed_by_user").references(() => users.id),
    decision: text("decision"),
    reason: text("reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("decision_value", sql`${t.decision} IS NULL OR ${t.decision} IN ('APPROVED','REJECTED')`),
    check("separation_of_duties", sql`${t.reviewedByUser} IS NULL OR ${t.reviewedByUser} <> ${t.submittedBy}`),
    index("vr_pending").on(t.assignedCoach).where(sql`${t.decision} IS NULL`),
  ],
);

export const blockchainAnchors = pgTable("blockchain_anchors", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id")
    .notNull()
    .references((): AnyPgColumn => verifiableRecords.id),
  chainId: integer("chain_id").notNull(),
  contractAddress: varchar("contract_address", { length: 42 }).notNull(),
  recordKey: bytea("record_key").notNull(),
  recordHash: bytea("record_hash").notNull(),
  verifierAddress: varchar("verifier_address", { length: 42 }).notNull(),
  txHash: varchar("tx_hash", { length: 66 }).unique(),
  blockNumber: integer("block_number"),
  blockTime: timestamp("block_time", { withTimezone: true }),
  status: anchorStatus("status").notNull(),
  supersedesId: uuid("supersedes_id").references((): AnyPgColumn => blockchainAnchors.id),
  error: text("error"),
  ...timestamps,
});

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => verifiableRecords.id),
    raisedBy: uuid("raised_by").notNull().references(() => users.id),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolution: text("resolution"),
    ...timestamps,
  },
  (t) => [check("dispute_status", sql`${t.status} IN ('OPEN','UPHELD','DISMISSED')`)],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    athleteId: uuid("athlete_id").notNull().references(() => athletes.id),
    recordId: uuid("record_id").references(() => verifiableRecords.id),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [check("share_scope", sql`${t.scope} IN ('RECORD','PROFILE')`)],
);

// ------------------------------------------------------------------ platform
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notif_unread").on(t.userId).where(sql`${t.readAt} IS NULL`)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ip: inet("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity").on(t.entity, t.entityId)],
);

export type User = typeof users.$inferSelect;
export type Role = (typeof userRole.enumValues)[number];
