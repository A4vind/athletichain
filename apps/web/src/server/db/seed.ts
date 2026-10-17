/**
 * Demo seed data: logically connected, deterministic (no Math.random).
 *
 *   2 academies · 3 teams · 6 sports (2 fully built) · 4 coaches · 10 athletes
 *   12 weeks of training sessions with attendance · monthly results per athlete
 *   goals · achievements and milestones · verification requests
 *
 * Nothing here is anchored on-chain: blockchain anchors are only ever created by a
 * real transaction (Phase 4), never inserted by a seed script.
 *
 * Every demo login uses the password  Demo@1234
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import { hash } from "@node-rs/argon2";
import { generateSalt, hashRecord } from "@athletichain/canonical";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "./schema";

const DEMO_PASSWORD = "Demo@1234";
const TODAY = "2026-10-07";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

// ------------------------------------------------------------------ helpers
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Small deterministic generator so attendance looks human but is reproducible. */
function lcg(seed: number) {
  let x = seed;
  return () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

// ------------------------------------------------------------------ sports
const SPORTS = [
  { code: "ATHLETICS", name: "Athletics", isFullyBuilt: true },
  { code: "CRICKET", name: "Cricket", isFullyBuilt: true },
  { code: "FOOTBALL", name: "Football", isFullyBuilt: false },
  { code: "BADMINTON", name: "Badminton", isFullyBuilt: false },
  { code: "BASKETBALL", name: "Basketball", isFullyBuilt: false },
  { code: "COMBAT", name: "Combat sports", isFullyBuilt: false },
] as const;

type MetricSeed = { code: string; name: string; unit: string; direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER"; decimals: number; anchorable: boolean };
const METRICS: Record<(typeof SPORTS)[number]["code"], MetricSeed[]> = {
  ATHLETICS: [
    { code: "100m", name: "100m time", unit: "s", direction: "LOWER_IS_BETTER", decimals: 2, anchorable: true },
    { code: "200m", name: "200m time", unit: "s", direction: "LOWER_IS_BETTER", decimals: 2, anchorable: true },
    { code: "400m", name: "400m time", unit: "s", direction: "LOWER_IS_BETTER", decimals: 2, anchorable: true },
    { code: "long_jump", name: "Long jump", unit: "m", direction: "HIGHER_IS_BETTER", decimals: 2, anchorable: true },
    { code: "top_speed", name: "Top speed", unit: "km/h", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: false },
  ],
  CRICKET: [
    { code: "runs", name: "Runs in innings", unit: "runs", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "wickets", name: "Wickets in match", unit: "wickets", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "strike_rate", name: "Batting strike rate", unit: "SR", direction: "HIGHER_IS_BETTER", decimals: 2, anchorable: false },
    { code: "economy", name: "Bowling economy", unit: "runs/over", direction: "LOWER_IS_BETTER", decimals: 2, anchorable: false },
  ],
  FOOTBALL: [
    { code: "goals", name: "Goals", unit: "goals", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "assists", name: "Assists", unit: "assists", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "pass_accuracy", name: "Passing accuracy", unit: "%", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: false },
    { code: "sprint_speed", name: "Sprint speed", unit: "km/h", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: false },
  ],
  BADMINTON: [
    { code: "matches_won", name: "Matches won", unit: "wins", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "ranking", name: "State ranking", unit: "rank", direction: "LOWER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "smash_speed", name: "Smash speed", unit: "km/h", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: false },
  ],
  BASKETBALL: [
    { code: "points", name: "Points per game", unit: "pts", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: true },
    { code: "rebounds", name: "Rebounds per game", unit: "reb", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: false },
    { code: "ft_pct", name: "Free-throw percentage", unit: "%", direction: "HIGHER_IS_BETTER", decimals: 1, anchorable: false },
  ],
  COMBAT: [
    { code: "bouts_won", name: "Bouts won", unit: "wins", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: true },
    { code: "strikes_landed", name: "Significant strikes landed", unit: "strikes", direction: "HIGHER_IS_BETTER", decimals: 0, anchorable: false },
  ],
};

// ------------------------------------------------------------------ people
const COACHES = [
  { code: "COA-0001", name: "Rohan Pillai", email: "rohan@athletichain.dev", academy: "WSA", sport: "ATHLETICS", approved: true },
  { code: "COA-0002", name: "Anjali Rao", email: "anjali@athletichain.dev", academy: "WSA", sport: "ATHLETICS", approved: true },
  { code: "COA-0003", name: "Farhan Qureshi", email: "farhan@athletichain.dev", academy: "DCA", sport: "CRICKET", approved: true },
  // Pending: the admin approves this coach in step 1 of the demo.
  { code: "COA-0004", name: "Kabir Malhotra", email: "kabir@athletichain.dev", academy: "DCA", sport: "CRICKET", approved: false },
] as const;

type AthleteSeed = {
  code: string; name: string; email: string; dob: string; sport: "ATHLETICS" | "CRICKET";
  position: string; team: string; coach: string; guardian?: { name: string; email: string; consent: boolean };
  /** monthly results Apr..Sep for the primary metric */
  metric: string; series: number[]; bio: string;
};

const ATHLETES: AthleteSeed[] = [
  { code: "ATH-0007", name: "Rahul Mehta", email: "rahul@athletichain.dev", dob: "2007-03-14", sport: "ATHLETICS", position: "Sprints · 100m / 200m", team: "Sprint Squad A", coach: "COA-0002",
    metric: "100m", series: [13.05, 12.92, 12.8, 12.71, 12.58, 12.4], bio: "Sprinter focused on 100m. Training for the state junior trials." },
  { code: "ATH-0008", name: "Arjun Kulkarni", email: "arjun@athletichain.dev", dob: "2008-07-02", sport: "ATHLETICS", position: "Sprints · 200m", team: "Sprint Squad A", coach: "COA-0002",
    guardian: { name: "Suresh Kulkarni", email: "suresh.k@example.com", consent: true }, metric: "200m", series: [26.4, 26.1, 25.95, 25.8, 25.71, 25.6], bio: "200m specialist, strong bend running." },
  { code: "ATH-0009", name: "Sana Shaikh", email: "sana@athletichain.dev", dob: "2006-11-21", sport: "ATHLETICS", position: "Sprints · 400m", team: "Sprint Squad A", coach: "COA-0002",
    metric: "400m", series: [60.8, 60.1, 59.62, 59.4, 58.95, 58.71], bio: "400m runner moving up from 200m." },
  { code: "ATH-0010", name: "Isha Verma", email: "isha@athletichain.dev", dob: "2009-05-09", sport: "ATHLETICS", position: "Sprints · 100m", team: "Sprint Squad A", coach: "COA-0001",
    guardian: { name: "Meena Verma", email: "meena.v@example.com", consent: false }, metric: "100m", series: [13.9, 13.82, 13.7, 13.74, 13.61, 13.55], bio: "Youngest in the sprint group." },
  { code: "ATH-0011", name: "Priya Nair", email: "priya@athletichain.dev", dob: "2007-01-30", sport: "ATHLETICS", position: "Jumps · Long jump", team: "Jumps Group", coach: "COA-0001",
    metric: "long_jump", series: [5.41, 5.5, 5.58, 5.55, 5.7, 5.82], bio: "Long jumper, district record holder in U-18." },
  { code: "ATH-0012", name: "Dev Patel", email: "dev@athletichain.dev", dob: "2008-09-17", sport: "ATHLETICS", position: "Jumps · Long jump", team: "Jumps Group", coach: "COA-0001",
    guardian: { name: "Nikhil Patel", email: "nikhil.p@example.com", consent: true }, metric: "long_jump", series: [5.02, 5.1, 5.08, 5.19, 5.24, 5.31], bio: "Converting from triple jump." },
  { code: "ATH-0013", name: "Aditya Rane", email: "aditya@athletichain.dev", dob: "2007-08-05", sport: "CRICKET", position: "Top-order batter", team: "U-19 Cricket XI", coach: "COA-0003",
    metric: "runs", series: [34, 51, 28, 67, 45, 82], bio: "Opening batter, right-handed." },
  { code: "ATH-0014", name: "Kunal Joshi", email: "kunal@athletichain.dev", dob: "2008-02-12", sport: "CRICKET", position: "Fast bowler", team: "U-19 Cricket XI", coach: "COA-0003",
    guardian: { name: "Anita Joshi", email: "anita.j@example.com", consent: true }, metric: "wickets", series: [1, 2, 2, 3, 1, 4], bio: "Right-arm fast-medium." },
  { code: "ATH-0015", name: "Neha Sawant", email: "neha@athletichain.dev", dob: "2007-12-03", sport: "CRICKET", position: "All-rounder", team: "U-19 Cricket XI", coach: "COA-0003",
    metric: "runs", series: [22, 30, 41, 19, 38, 55], bio: "Middle-order bat and off-spin." },
  { code: "ATH-0016", name: "Omkar Patil", email: "omkar@athletichain.dev", dob: "2008-04-26", sport: "CRICKET", position: "Wicketkeeper-batter", team: "U-19 Cricket XI", coach: "COA-0003",
    guardian: { name: "Ramesh Patil", email: "ramesh.p@example.com", consent: true }, metric: "runs", series: [15, 27, 33, 30, 44, 39], bio: "Keeper, finishes innings." },
];

const MONTH_DATES = ["2026-04-18", "2026-05-16", "2026-06-13", "2026-07-11", "2026-08-08", "2026-09-10"];

async function main() {
  const existing = await db.select({ id: s.users.id }).from(s.users).limit(1);
  if (existing.length) {
    console.log("Database already seeded. Run `pnpm db:reset` to start over.");
    return;
  }

  const passwordHash = await hash(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    // --- admin
    const [admin] = await tx
      .insert(s.users)
      .values({ email: "admin@athletichain.dev", passwordHash, role: "ADMIN", fullName: "Academy Admin" })
      .returning();

    // --- sports + metrics
    const sportId: Record<string, string> = {};
    const metricRow: Record<string, typeof s.sportMetrics.$inferSelect> = {};
    for (const sp of SPORTS) {
      const [row] = await tx.insert(s.sports).values(sp).returning();
      sportId[sp.code] = row.id;
      for (const m of METRICS[sp.code]) {
        const [mr] = await tx
          .insert(s.sportMetrics)
          .values({ sportId: row.id, code: m.code, name: m.name, unit: m.unit, direction: m.direction, decimals: m.decimals, isAnchorable: m.anchorable })
          .returning();
        metricRow[`${sp.code}:${m.code}`] = mr;
      }
    }

    // --- academies + teams
    const [wsa] = await tx.insert(s.academies).values({ name: "Western Stars Academy", city: "Mumbai", adminUserId: admin.id }).returning();
    const [dca] = await tx.insert(s.academies).values({ name: "Deccan Cricket Academy", city: "Pune", adminUserId: admin.id }).returning();
    const academyId = { WSA: wsa.id, DCA: dca.id };
    const teamRows = await tx
      .insert(s.teams)
      .values([
        { academyId: wsa.id, sportId: sportId.ATHLETICS, name: "Sprint Squad A" },
        { academyId: wsa.id, sportId: sportId.ATHLETICS, name: "Jumps Group" },
        { academyId: dca.id, sportId: sportId.CRICKET, name: "U-19 Cricket XI" },
      ])
      .returning();
    const teamId = Object.fromEntries(teamRows.map((t) => [t.name, t.id]));

    // --- coaches
    const coachRow: Record<string, typeof s.coaches.$inferSelect & { userId: string; name: string }> = {};
    for (const c of COACHES) {
      const [u] = await tx
        .insert(s.users)
        .values({ email: c.email, passwordHash, role: "COACH", fullName: c.name, status: c.approved ? "ACTIVE" : "PENDING_APPROVAL" })
        .returning();
      const [row] = await tx
        .insert(s.coaches)
        .values({
          userId: u.id,
          academyId: academyId[c.academy],
          sportId: sportId[c.sport],
          publicCode: c.code,
          approvedBy: c.approved ? admin.id : null,
          approvedAt: c.approved ? new Date("2026-01-12T05:30:00Z") : null,
        })
        .returning();
      coachRow[c.code] = { ...row, name: c.name };
    }

    // --- athletes, assignments, teams
    const athleteRow: Record<string, typeof s.athletes.$inferSelect & { userId: string; seed: AthleteSeed }> = {};
    for (const a of ATHLETES) {
      const [u] = await tx.insert(s.users).values({ email: a.email, passwordHash, role: "ATHLETE", fullName: a.name }).returning();
      const [row] = await tx
        .insert(s.athletes)
        .values({
          userId: u.id,
          publicCode: a.code,
          sportId: sportId[a.sport],
          position: a.position,
          dateOfBirth: a.dob,
          bio: a.bio,
          guardianName: a.guardian?.name,
          guardianEmail: a.guardian?.email,
          guardianConsentAt: a.guardian?.consent ? new Date("2026-01-20T06:00:00Z") : null,
        })
        .returning();
      athleteRow[a.code] = { ...row, seed: a };
      await tx.insert(s.coachAssignments).values({ coachId: coachRow[a.coach].id, athleteId: row.id, startDate: "2026-01-12" });
      await tx.insert(s.teamMemberships).values({ teamId: teamId[a.team], athleteId: row.id, startDate: "2026-01-12" });
    }
    // Transfer history: Rahul trained with Rohan before moving to Anjali in March.
    await tx.insert(s.coachAssignments).values({
      coachId: coachRow["COA-0001"].id,
      athleteId: athleteRow["ATH-0007"].id,
      startDate: "2025-08-01",
      endDate: "2026-01-11",
    });

    // --- training sessions: 12 weeks, Mon/Wed/Fri (+ Sat for sprints), per coach group
    const SESSION_TYPES = {
      ATHLETICS: [
        { type: "Speed training", minutes: 90, intensity: "HIGH", exercises: "Block starts ×6, 30m flys ×4, 60m ×3" },
        { type: "Strength and conditioning", minutes: 75, intensity: "MEDIUM", exercises: "Squats, hip thrusts, plyometrics" },
        { type: "Technique drills", minutes: 60, intensity: "LOW", exercises: "A-skips, B-skips, wall drills, stride length" },
        { type: "Speed endurance", minutes: 90, intensity: "HIGH", exercises: "150m ×4, 120m ×4 at 90%" },
      ],
      CRICKET: [
        { type: "Net session", minutes: 120, intensity: "MEDIUM", exercises: "Throwdowns, spin nets, pace nets" },
        { type: "Fielding drills", minutes: 60, intensity: "MEDIUM", exercises: "High catches, ground fielding, direct hits" },
        { type: "Fitness", minutes: 60, intensity: "HIGH", exercises: "Yo-yo test prep, shuttle runs" },
        { type: "Match simulation", minutes: 150, intensity: "HIGH", exercises: "20-over centre-wicket game" },
      ],
    } as const;
    const firstMonday = "2026-07-13";
    const rand = lcg(42);
    let sessionCount = 0;
    for (const coachCode of ["COA-0001", "COA-0002", "COA-0003"] as const) {
      const coach = coachRow[coachCode];
      const group = ATHLETES.filter((a) => a.coach === coachCode);
      const sport = group[0].sport;
      const offsets = coachCode === "COA-0002" ? [0, 2, 4, 5] : [0, 2, 4];
      for (let week = 0; week < 12; week++) {
        for (const [i, off] of offsets.entries()) {
          const day = addDays(firstMonday, week * 7 + off);
          if (day > TODAY) continue;
          const t = SESSION_TYPES[sport][(week + i) % 4];
          const [sess] = await tx
            .insert(s.trainingSessions)
            .values({
              coachId: coach.id,
              teamId: teamId[group[0].team],
              sessionDate: day,
              type: t.type,
              durationMin: t.minutes,
              intensity: t.intensity,
              exercises: t.exercises,
              notes: week === 9 && i === 0 ? "Heavy rain, moved indoors" : null,
            })
            .returning();
          sessionCount++;
          await tx.insert(s.sessionAttendance).values(
            group.map((a) => {
              const r = rand();
              const status = r < 0.86 ? "PRESENT" : r < 0.94 ? "EXCUSED" : "ABSENT";
              return {
                sessionId: sess.id,
                athleteId: athleteRow[a.code].id,
                status,
                observation:
                  a.code === "ATH-0007" && t.type === "Speed training" && status === "PRESENT" && week > 8
                    ? "Drive phase cleaner, holds lean to 30m"
                    : null,
              };
            }),
          );
        }
      }
    }

    // --- performance records (monthly, primary metric) + verification state
    let seq = 400;
    const nextPublicId = (prefix: string, d: string) => `${prefix}-${d.slice(0, 4)}-${String(++seq).padStart(4, "0")}`;

    for (const a of ATHLETES) {
      const athlete = athleteRow[a.code];
      const coach = coachRow[a.coach];
      const metric = metricRow[`${a.sport}:${a.metric}`];
      for (const [i, value] of a.series.entries()) {
        const recordedOn = MONTH_DATES[i];
        const isLatest = i === a.series.length - 1;
        // Athletics: older results entered by the *other* athletics coach acting as timekeeper,
        // so the head coach can verify them without approving their own entry.
        // Cricket: the athlete self-reports from the scorebook. The latest result is always self-reported.
        const assistant = a.coach === "COA-0002" ? coachRow["COA-0001"] : coachRow["COA-0002"];
        const coachEntered = !isLatest && a.sport === "ATHLETICS";
        const source = coachEntered ? "COACH_ENTERED" : "SELF_REPORTED";
        const enteredBy = coachEntered ? assistant.userId : athlete.userId;
        const [perf] = await tx
          .insert(s.performanceRecords)
          .values({
            athleteId: athlete.id,
            metricId: metric.id,
            eventName: i === 5 ? "Mumbai Inter-Academy Meet" : i === 2 ? "District Open" : "Academy time trial",
            value: String(value),
            recordedOn,
            conditions: a.sport === "ATHLETICS" && a.metric !== "long_jump" ? "Hand-timed ×2" : null,
            source,
            enteredBy,
          })
          .returning();

        if (!metric.isAnchorable || i < 3) continue;

        // Months 4–5: coach verified (not anchored — that needs a real transaction).
        // Month 6: submitted by the athlete, waiting in the coach's queue.
        const salt = generateSalt();
        const publicId = nextPublicId("PERF", recordedOn);
        if (!isLatest) {
          const canonicalHash = hashRecord({
            athleteId: a.code,
            recordType: "PERFORMANCE",
            metric: metric.code,
            value,
            decimals: metric.decimals,
            unit: metric.unit,
            date: recordedOn,
            verifierId: coach.publicCode,
            salt,
            evidenceHashes: [],
          });
          const verifiedAt = new Date(`${addDays(recordedOn, 2)}T12:00:00Z`);
          const [vr] = await tx
            .insert(s.verifiableRecords)
            .values({
              publicId,
              performanceRecordId: perf.id,
              salt: Buffer.from(salt, "hex"),
              status: "VERIFIED",
              verifiedBy: coach.id,
              verifiedAt,
              canonicalHash: Buffer.from(canonicalHash, "hex"),
            })
            .returning();
          await tx.insert(s.verificationRequests).values({
            recordId: vr.id,
            submittedBy: enteredBy, // never the reviewing coach (separation of duties)
            assignedCoach: coach.id,
            reviewedByUser: coach.userId,
            decision: "APPROVED",
            decidedAt: verifiedAt,
          });
        } else {
          const [vr] = await tx
            .insert(s.verifiableRecords)
            .values({ publicId, performanceRecordId: perf.id, salt: Buffer.from(salt, "hex"), status: "PENDING" })
            .returning();
          await tx.insert(s.verificationRequests).values({
            recordId: vr.id,
            submittedBy: athlete.userId,
            assignedCoach: coach.id,
          });
        }
      }
    }

    // --- goals (direction-aware)
    const goalDefs: { athlete: string; metric: string; title: string; start: number; target: number; deadline: string }[] = [
      { athlete: "ATH-0007", metric: "ATHLETICS:100m", title: "100m under 12.30 s", start: 12.8, target: 12.3, deadline: "2026-10-31" },
      { athlete: "ATH-0007", metric: "ATHLETICS:200m", title: "200m under 25.00 s", start: 26.0, target: 25.0, deadline: "2026-10-20" },
      { athlete: "ATH-0008", metric: "ATHLETICS:200m", title: "200m under 25.40 s", start: 26.4, target: 25.4, deadline: "2026-11-15" },
      { athlete: "ATH-0009", metric: "ATHLETICS:400m", title: "Break 58.5 s in 400m", start: 60.8, target: 58.5, deadline: "2026-12-01" },
      { athlete: "ATH-0010", metric: "ATHLETICS:100m", title: "100m under 13.40 s", start: 13.9, target: 13.4, deadline: "2026-11-30" },
      { athlete: "ATH-0011", metric: "ATHLETICS:long_jump", title: "Jump 6.00 m", start: 5.41, target: 6.0, deadline: "2026-12-15" },
      { athlete: "ATH-0012", metric: "ATHLETICS:long_jump", title: "Jump 5.50 m", start: 5.02, target: 5.5, deadline: "2026-12-15" },
      { athlete: "ATH-0013", metric: "CRICKET:runs", title: "Score a century", start: 34, target: 100, deadline: "2027-01-31" },
      { athlete: "ATH-0014", metric: "CRICKET:wickets", title: "5-wicket haul", start: 1, target: 5, deadline: "2027-01-31" },
      { athlete: "ATH-0015", metric: "CRICKET:runs", title: "Score 75 in an innings", start: 22, target: 75, deadline: "2026-12-31" },
    ];
    for (const g of goalDefs) {
      const a = athleteRow[g.athlete];
      await tx.insert(s.goals).values({
        athleteId: a.id,
        metricId: metricRow[g.metric].id,
        setBy: coachRow[a.seed.coach].id,
        title: g.title,
        startValue: String(g.start),
        targetValue: String(g.target),
        deadline: g.deadline,
      });
    }
    // Rahul's 200m results so his 200m goal has data.
    for (const [i, v] of [26.0, 25.9, 25.8, 25.74, 25.6].entries()) {
      await tx.insert(s.performanceRecords).values({
        athleteId: athleteRow["ATH-0007"].id,
        metricId: metricRow["ATHLETICS:200m"].id,
        eventName: "Academy time trial",
        value: String(v),
        recordedOn: addDays(MONTH_DATES[i + 1], 3),
        source: "COACH_ENTERED",
        enteredBy: coachRow["COA-0002"].userId,
      });
    }

    // --- achievements and milestones
    const achDefs = [
      { athlete: "ATH-0007", kind: "ACHIEVEMENT", title: "Tournament winner", event: "Mumbai Inter-Academy Meet · 100m", result: "1st", on: "2026-09-10", status: "PENDING" },
      { athlete: "ATH-0007", kind: "MILESTONE", title: "New personal best · 100m", event: "Academy time trial", result: "12.58 s", on: "2026-08-08", status: "VERIFIED" },
      { athlete: "ATH-0008", kind: "ACHIEVEMENT", title: "Runner-up", event: "Mumbai Inter-Academy Meet · 200m", result: "2nd", on: "2026-09-10", status: "PENDING" },
      { athlete: "ATH-0009", kind: "MILESTONE", title: "100 training sessions", event: null, result: "100 sessions", on: "2026-09-28", status: "PENDING" },
      { athlete: "ATH-0011", kind: "ACHIEVEMENT", title: "District champion", event: "District Open · Long jump", result: "1st, 5.58 m", on: "2026-06-13", status: "VERIFIED" },
      { athlete: "ATH-0013", kind: "ACHIEVEMENT", title: "Player of the match", event: "Pune U-19 League vs Kolhapur", result: "82 off 64", on: "2026-09-10", status: "VERIFIED" },
      { athlete: "ATH-0014", kind: "MILESTONE", title: "First 4-wicket haul", event: "Pune U-19 League", result: "4/31", on: "2026-09-10", status: "DRAFT" },
    ] as const;
    for (const d of achDefs) {
      const a = athleteRow[d.athlete];
      const coach = coachRow[a.seed.coach];
      const [ach] = await tx
        .insert(s.achievements)
        .values({ athleteId: a.id, kind: d.kind, title: d.title, eventName: d.event, result: d.result, achievedOn: d.on, enteredBy: a.userId })
        .returning();
      if (d.status === "DRAFT") continue;
      const salt = generateSalt();
      const isVerified = d.status === "VERIFIED";
      const canonicalHash = isVerified
        ? hashRecord({
            athleteId: a.publicCode,
            recordType: d.kind,
            metric: d.title,
            value: d.result,
            unit: d.event ?? "",
            date: d.on,
            verifierId: coach.publicCode,
            salt,
            evidenceHashes: [],
          })
        : null;
      const [vr] = await tx
        .insert(s.verifiableRecords)
        .values({
          publicId: nextPublicId(d.kind === "MILESTONE" ? "MILE" : "ACH", d.on),
          achievementId: ach.id,
          salt: Buffer.from(salt, "hex"),
          status: d.status,
          verifiedBy: isVerified ? coach.id : null,
          verifiedAt: isVerified ? new Date(`${addDays(d.on, 3)}T10:00:00Z`) : null,
          canonicalHash: canonicalHash ? Buffer.from(canonicalHash, "hex") : null,
        })
        .returning();
      await tx.insert(s.verificationRequests).values({
        recordId: vr.id,
        submittedBy: a.userId,
        assignedCoach: coach.id,
        reviewedByUser: isVerified ? coach.userId : null,
        decision: isVerified ? "APPROVED" : null,
        decidedAt: isVerified ? new Date(`${addDays(d.on, 3)}T10:00:00Z`) : null,
      });
    }

    // --- coach feedback
    await tx.insert(s.coachFeedback).values([
      { athleteId: athleteRow["ATH-0007"].id, coachId: coachRow["COA-0002"].id, body: "Drive phase is cleaner. Hold the lean to 30m before you rise." },
      { athleteId: athleteRow["ATH-0007"].id, coachId: coachRow["COA-0002"].id, body: "Good week. Keep the Saturday session, it is paying off in the last 20m." },
      { athleteId: athleteRow["ATH-0008"].id, coachId: coachRow["COA-0002"].id, body: "Bend running improving; relax the shoulders off the curve." },
      { athleteId: athleteRow["ATH-0011"].id, coachId: coachRow["COA-0001"].id, body: "Penultimate step is still long. Shorten it and attack the board." },
      { athleteId: athleteRow["ATH-0013"].id, coachId: coachRow["COA-0003"].id, body: "Excellent shot selection against spin. Work on rotating strike early on." },
      { athleteId: athleteRow["ATH-0014"].id, coachId: coachRow["COA-0003"].id, body: "Seam position much better. Watch the front-foot no-balls." },
    ]);

    // --- notifications
    await tx.insert(s.notifications).values([
      { userId: coachRow["COA-0002"].userId, type: "VERIFICATION_REQUESTED", title: "Rahul Mehta submitted 100m · 12.40 s for verification", link: "/coach/verifications" },
      { userId: athleteRow["ATH-0007"].userId, type: "FEEDBACK", title: "New feedback from Coach Anjali Rao", link: "/athlete/dashboard" },
      { userId: athleteRow["ATH-0007"].userId, type: "GOAL_DEADLINE", title: "200m goal deadline in 13 days", link: "/athlete/goals" },
      { userId: admin.id, type: "COACH_PENDING", title: "Kabir Malhotra is waiting for coach approval", link: "/admin/coaches" },
    ]);

    // --- audit log
    await tx.insert(s.auditLogs).values([
      { actorId: admin.id, action: "SEED", entity: "system", newValue: { sessions: sessionCount, athletes: ATHLETES.length } },
    ]);

    console.log(`Seeded: 1 admin, ${COACHES.length} coaches, ${ATHLETES.length} athletes, ${sessionCount} training sessions.`);
  });

  console.log(`All demo accounts use the password ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
