import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role } from "@/server/db/schema";

export async function getCurrentUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.sub) });
  if (!user || user.status === "SUSPENDED") return null;
  return user;
}

/** For server components and actions: the signed-in user with the given role, or a redirect. */
export async function requireUser(role: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/forbidden");
  return user;
}
