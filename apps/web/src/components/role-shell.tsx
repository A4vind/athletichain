import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import type { Role } from "@/server/db/schema";
import { AppShell } from "./app-shell";
import { navFor } from "./nav";

/** Server layout wrapper: signed-in user of the given role(s), with the right menu. */
export async function RoleShell({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/forbidden");
  const { nav, roleLabel } = await navFor(user);
  return (
    <AppShell user={{ name: user.fullName, roleLabel }} nav={nav}>
      {children}
    </AppShell>
  );
}
