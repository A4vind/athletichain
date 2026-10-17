import { NextResponse, type NextRequest } from "next/server";
import { HOME_FOR_ROLE, SESSION_COOKIE, verifySession } from "@/server/auth/session";
import type { Role } from "@/server/db/schema";

/** First line of role protection. Services re-check ownership on every call. */
const AREA_ROLE: { prefix: string; role: Role }[] = [
  { prefix: "/athlete", role: "ATHLETE" },
  { prefix: "/coach", role: "COACH" },
  { prefix: "/admin", role: "ADMIN" },
];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && session) {
    return NextResponse.redirect(new URL(HOME_FOR_ROLE[session.role], req.url));
  }

  if ((pathname.startsWith("/records/") || pathname === "/notifications") && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const area = AREA_ROLE.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
  if (!area) return NextResponse.next();

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session.role !== area.role) {
    return NextResponse.rewrite(new URL("/forbidden", req.url), { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/athlete/:path*", "/coach/:path*", "/admin/:path*", "/records/:path*", "/notifications", "/login", "/register", "/forgot-password"],
};
