import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "./session";
import type { User } from "@/server/db/schema";

export async function startSession(user: User) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.fullName });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
