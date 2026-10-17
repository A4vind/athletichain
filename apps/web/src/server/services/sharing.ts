/**
 * Portable verified profile: athletes share one record or their whole profile through
 * an unguessable link (and QR). Links expire, can be revoked, and need guardian
 * consent for athletes under 18. Public pages show only first name + initial.
 */
import { appUrl } from "@/server/lib/app-url";
import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { ageOn } from "@/server/validators/auth";
import { athleteForUser } from "./access";
import { audit } from "./audit";
import { listRecords } from "./records";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function shareCode() {
  const bytes = randomBytes(10);
  return "VR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const publicUrl = (code: string) => `${appUrl()}/verify/${code}`;

export async function createShareLink(userId: string, input: { scope: "RECORD" | "PROFILE"; publicId?: string; expiresInDays: number }) {
  const athlete = await athleteForUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  if (ageOn(athlete.dateOfBirth, today) < 18 && !athlete.guardianConsentAt) {
    throw new AppError("FORBIDDEN", "Your guardian hasn't given consent yet, so your records can't be shared publicly. Ask your academy admin to record their consent.");
  }
  let recordId: string | null = null;
  if (input.scope === "RECORD") {
    const [r] = await listRecords(sql`vr.public_id = ${input.publicId ?? ""} and a.id = ${athlete.id}`, 1);
    if (!r) throw new AppError("NOT_FOUND", "Record not found");
    if (r.status !== "ANCHORED" && r.status !== "VERIFIED") throw new AppError("CONFLICT", "Only coach-verified or anchored records can be shared");
    recordId = r.id;
  }
  const [link] = await db
    .insert(schema.shareLinks)
    .values({ code: shareCode(), athleteId: athlete.id, recordId, scope: input.scope, expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000) })
    .returning();
  await audit({ actorId: userId, action: "SHARE_LINK_CREATED", entity: "share_link", entityId: link.id, newValue: { scope: input.scope } });
  return link;
}

export async function revokeShareLink(userId: string, linkId: string) {
  const athlete = await athleteForUser(userId);
  const res = await db
    .update(schema.shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.shareLinks.id, linkId), eq(schema.shareLinks.athleteId, athlete.id), isNull(schema.shareLinks.revokedAt)))
    .returning();
  if (!res.length) throw new AppError("NOT_FOUND", "Link not found");
  await audit({ actorId: userId, action: "SHARE_LINK_REVOKED", entity: "share_link", entityId: linkId });
}

export async function qrSvg(code: string) {
  return QRCode.toString(publicUrl(code), { type: "svg", margin: 1, color: { dark: "#0E1116", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
}

export type ShareResolution =
  | { state: "invalid" | "revoked" | "expired" }
  | {
      state: "ok";
      scope: "RECORD" | "PROFILE";
      athlete: { display: string; sport: string; position: string | null; academy: string | null };
      records: Awaited<ReturnType<typeof listRecords>>;
      selfReported: { title: string; display: string; date: string }[];
      expiresAt: Date | null;
    };

export async function resolveShare(code: string): Promise<ShareResolution> {
  const link = await db.query.shareLinks.findFirst({ where: eq(schema.shareLinks.code, code) });
  if (!link) return { state: "invalid" };
  if (link.revokedAt) return { state: "revoked" };
  if (link.expiresAt && link.expiresAt < new Date()) return { state: "expired" };
  await db.update(schema.shareLinks).set({ viewCount: sql`${schema.shareLinks.viewCount} + 1` }).where(eq(schema.shareLinks.id, link.id));

  const res = await db.execute(sql`
    select u.full_name as name, s.name as sport, a.position, ac.name as academy
    from athletes a join users u on u.id = a.user_id join sports s on s.id = a.sport_id
    left join team_memberships tm on tm.athlete_id = a.id and tm.end_date is null
    left join teams t on t.id = tm.team_id left join academies ac on ac.id = t.academy_id
    where a.id = ${link.athleteId}`);
  const info = res.rows[0] as { name: string; sport: string; position: string | null; academy: string | null };
  const [first, ...rest] = info.name.split(" ");
  const display = rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;

  const records =
    link.scope === "RECORD"
      ? await listRecords(sql`vr.id = ${link.recordId}`, 1)
      : await listRecords(sql`a.id = ${link.athleteId} and vr.status in ('VERIFIED','ANCHORED','INTEGRITY_WARNING')`, 50);

  const selfReported =
    link.scope === "PROFILE"
      ? ((
          await db.execute(sql`
            select m.name as title, trim(to_char(pr.value, 'FM9999990.00')) || ' ' || m.unit as display, to_char(pr.recorded_on, 'YYYY-MM-DD') as date
            from performance_records pr join sport_metrics m on m.id = pr.metric_id
            left join verifiable_records vr on vr.performance_record_id = pr.id
            where pr.athlete_id = ${link.athleteId} and pr.source = 'SELF_REPORTED' and (vr.id is null or vr.status in ('DRAFT','PENDING'))
            order by pr.recorded_on desc limit 10`)
        ).rows as { title: string; display: string; date: string }[])
      : [];

  return { state: "ok", scope: link.scope as "RECORD" | "PROFILE", athlete: { display, sport: info.sport, position: info.position, academy: info.academy }, records, selfReported, expiresAt: link.expiresAt };
}
