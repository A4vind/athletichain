import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import type { User } from "@/server/db/schema";
import type { NavItem } from "./app-shell";

async function count(q: ReturnType<typeof sql>) {
  return ((await db.execute(q)).rows[0] as { n: number }).n;
}

export async function navFor(user: User): Promise<{ nav: NavItem[]; roleLabel: string }> {
  const unread = await count(sql`select count(*)::int as n from notifications where user_id = ${user.id} and read_at is null`);
  const notifications: NavItem = { href: "/notifications", label: "Notifications", count: unread, icon: "bell" };

  if (user.role === "ATHLETE") {
    return {
      roleLabel: "Athlete",
      nav: [
        { href: "/athlete/dashboard", label: "Dashboard", icon: "home", primary: true, short: "Home" },
        { href: "/athlete/profile", label: "Profile", icon: "userCheck" },
        { href: "/athlete/training", label: "Training", icon: "training" },
        { href: "/athlete/performance", label: "Performance", icon: "performance", primary: true, short: "Results" },
        { href: "/athlete/goals", label: "Goals", icon: "goals" },
        { href: "/athlete/achievements", label: "Achievements", icon: "award" },
        { href: "/athlete/verification", label: "Verification", icon: "shield", primary: true, short: "Verify" },
        { href: "/athlete/sharing", label: "Verified profile", icon: "qr", primary: true, short: "Share" },
        notifications,
        { href: "/athlete/settings", label: "Settings", icon: "settings" },
      ],
    };
  }
  if (user.role === "COACH") {
    if (user.status === "PENDING_APPROVAL") return { roleLabel: "Coach · awaiting approval", nav: [{ href: "/coach/dashboard", label: "Dashboard", icon: "home", primary: true, short: "Home" }] };
    const queue = await count(sql`
      select count(*)::int as n from verification_requests r join verifiable_records vr on vr.id = r.record_id
      join coaches c on c.id = r.assigned_coach where c.user_id = ${user.id} and r.decision is null and vr.status = 'PENDING'`);
    return {
      roleLabel: "Coach",
      nav: [
        { href: "/coach/dashboard", label: "Dashboard", icon: "home", primary: true, short: "Home" },
        { href: "/coach/athletes", label: "My athletes", icon: "users", primary: true, short: "Athletes" },
        { href: "/coach/training", label: "Training", icon: "training", primary: true, short: "Training" },
        { href: "/coach/performance", label: "Performance", icon: "performance" },
        { href: "/coach/goals", label: "Goals", icon: "goals" },
        { href: "/coach/achievements", label: "Achievements", icon: "award" },
        { href: "/coach/verifications", label: "Verifications", count: queue, icon: "clipboard", primary: true, short: "Verify" },
        { href: "/coach/blockchain", label: "Blockchain", icon: "chain" },
        notifications,
        { href: "/coach/settings", label: "Profile & settings", icon: "settings" },
      ],
    };
  }
  const pending = await count(sql`select count(*)::int as n from users where role = 'COACH' and status = 'PENDING_APPROVAL'`);
  const disputes = await count(sql`select count(*)::int as n from disputes where status = 'OPEN'`);
  const warnings = await count(sql`select count(*)::int as n from verifiable_records where status = 'INTEGRITY_WARNING'`);
  return {
    roleLabel: "Academy admin",
    nav: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "home", primary: true, short: "Home" },
      { href: "/admin/coaches", label: "Coach approvals", count: pending, icon: "userCheck", primary: true, short: "Approvals" },
      { href: "/admin/users", label: "Users", icon: "users", primary: true, short: "Users" },
      { href: "/admin/athletes", label: "Athletes", icon: "training" },
      { href: "/admin/academies", label: "Academies & teams", icon: "building" },
      { href: "/admin/sports", label: "Sports & metrics", icon: "layers" },
      { href: "/admin/verifications", label: "Verifications", icon: "clipboard" },
      { href: "/admin/disputes", label: "Disputes", count: disputes, icon: "alert" },
      { href: "/admin/blockchain", label: "Blockchain", count: warnings, icon: "chain", primary: true, short: "Chain" },
      { href: "/admin/audit-log", label: "Audit log", icon: "log" },
      notifications,
      { href: "/admin/settings", label: "Profile & settings", icon: "settings" },
    ],
  };
}
