import { eq } from "drizzle-orm";
import { Detail, PasswordCard } from "@/components/password-card";
import { PageHead, fmtDate } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { db, schema } from "@/server/db";

export const metadata = { title: "Profile & settings" };

export default async function AdminSettings() {
  const user = await requireUser("ADMIN");
  const academies = await db.select({ name: schema.academies.name, city: schema.academies.city }).from(schema.academies).where(eq(schema.academies.adminUserId, user.id));

  return (
    <>
      <PageHead kicker="Academy admin" title="Profile & settings" />

      <section className="card" aria-labelledby="acc-h">
        <div className="card-head"><h2 id="acc-h">Your account</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14, fontSize: 15 }}>
          <Detail label="Name">{user.fullName}</Detail>
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Role">Academy admin</Detail>
          <Detail label="Last login">{user.lastLoginAt ? fmtDate(user.lastLoginAt.toISOString().slice(0, 10)) : "—"}</Detail>
          <Detail label={academies.length === 1 ? "Academy" : "Academies"}>
            {academies.length ? academies.map((a) => `${a.name}${a.city ? `, ${a.city}` : ""}`).join(" · ") : "—"}
          </Detail>
        </div>
      </section>

      <PasswordCard />
    </>
  );
}
