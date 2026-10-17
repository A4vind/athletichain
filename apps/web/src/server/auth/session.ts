/**
 * Stateless sessions: a signed JWT (HS256) in an httpOnly, sameSite=lax cookie.
 * The token carries only the user id, role and display name. Anything that
 * matters (status, suspension) is re-checked against the database on each request
 * by requireUser().
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/server/db/schema";

export const SESSION_COOKIE = "ac_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working day

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  name: string;
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role as Role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  ATHLETE: "/athlete/dashboard",
  COACH: "/coach/dashboard",
  ADMIN: "/admin/dashboard",
};
