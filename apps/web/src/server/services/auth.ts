import "server-only";
import { appUrl } from "@/server/lib/app-url";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { rateLimit } from "@/server/lib/rate-limit";
import { ageOn, type RegisterInput } from "@/server/validators/auth";
import { audit } from "./audit";

// A real hash of a throwaway password, so failed logins for unknown emails
// take the same time as for real ones (no account enumeration by timing).
let dummyHashPromise: Promise<string> | null = null;
const dummyHash = () => (dummyHashPromise ??= hash("not-a-real-password-0"));

export async function login(email: string, password: string, ip: string) {
  const limit = rateLimit(`login:${ip}:${email}`, 5, 15 * 60 * 1000);
  if (!limit.ok) throw new AppError("RATE_LIMITED", `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`);

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = await verify(user?.passwordHash ?? (await dummyHash()), password);
  if (!user || !ok) throw new AppError("UNAUTHORIZED", "Email or password is incorrect");
  if (user.status === "SUSPENDED") throw new AppError("FORBIDDEN", "This account is suspended. Contact your academy admin.");

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit({ actorId: user.id, action: "LOGIN", entity: "user", entityId: user.id, ip });
  return user;
}

async function nextPublicCode(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], prefix: "ATH" | "COA") {
  const table = prefix === "ATH" ? schema.athletes : schema.coaches;
  const [{ max }] = await tx
    .select({ max: sql<number | null>`max(substring(${table.publicCode} from 5)::int)` })
    .from(table);
  return `${prefix}-${String((max ?? 0) + 1).padStart(4, "0")}`;
}

export async function register(input: RegisterInput, ip: string, today = new Date().toISOString().slice(0, 10)) {
  const limit = rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) throw new AppError("RATE_LIMITED", "Too many sign-ups from this network. Try again later.");

  const taken = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (taken) throw new AppError("CONFLICT", "An account with this email already exists");

  const sport = await db.query.sports.findFirst({ where: eq(schema.sports.code, input.sportCode) });
  if (!sport || !sport.isActive) throw new AppError("VALIDATION", "Choose a valid sport");

  if (input.role === "ATHLETE" && input.dateOfBirth && ageOn(input.dateOfBirth, today) < 18 && !input.guardianEmail) {
    throw new AppError("VALIDATION", "Athletes under 18 need a parent or guardian email");
  }

  const passwordHash = await hash(input.password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        email: input.email,
        passwordHash,
        role: input.role,
        fullName: input.fullName,
        // Coaches cannot verify anything until an admin approves them.
        status: input.role === "COACH" ? "PENDING_APPROVAL" : "ACTIVE",
      })
      .returning();

    if (input.role === "ATHLETE") {
      await tx.insert(schema.athletes).values({
        userId: user.id,
        publicCode: await nextPublicCode(tx, "ATH"),
        sportId: sport.id,
        position: input.position || null,
        dateOfBirth: input.dateOfBirth!,
        guardianName: input.guardianName || null,
        guardianEmail: input.guardianEmail || null,
      });
    } else {
      await tx.insert(schema.coaches).values({
        userId: user.id,
        publicCode: await nextPublicCode(tx, "COA"),
        sportId: sport.id,
        academyId: input.academyId!,
      });
      const admins = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
      if (admins.length) {
        await tx.insert(schema.notifications).values(
          admins.map((a) => ({ userId: a.id, type: "COACH_PENDING", title: `${input.fullName} is waiting for coach approval`, link: "/admin/coaches" })),
        );
      }
    }
    await audit({ actorId: user.id, action: "REGISTER", entity: "user", entityId: user.id, newValue: { role: input.role }, ip }, tx);
    return user;
  });
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a reset token valid for 30 minutes. Returns the link only so the
 * caller can email it (or, in development, show it). Always behaves the same
 * whether or not the email exists.
 */
export async function requestPasswordReset(email: string, ip: string): Promise<string | null> {
  const limit = rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) throw new AppError("RATE_LIMITED", "Too many requests. Try again later.");
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.passwordResets).values({
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  await audit({ actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entity: "user", entityId: user.id, ip });
  return `${appUrl()}/reset-password/${token}`;
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await db.query.passwordResets.findFirst({
    where: and(
      eq(schema.passwordResets.tokenHash, tokenHash(token)),
      isNull(schema.passwordResets.usedAt),
      gt(schema.passwordResets.expiresAt, new Date()),
    ),
  });
  if (!row) throw new AppError("VALIDATION", "This reset link is invalid or has expired");
  const passwordHash = await hash(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, row.userId));
    await tx.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, row.id));
    await audit({ actorId: row.userId, action: "PASSWORD_RESET", entity: "user", entityId: row.userId }, tx);
  });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || !(await verify(user.passwordHash, current))) throw new AppError("VALIDATION", "Your current password is incorrect");
  await db.update(schema.users).set({ passwordHash: await hash(next) }).where(eq(schema.users.id, userId));
  await audit({ actorId: userId, action: "PASSWORD_CHANGED", entity: "user", entityId: userId });
}
