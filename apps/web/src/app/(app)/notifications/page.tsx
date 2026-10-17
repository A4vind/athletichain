import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Empty, PageHead } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/current-user";
import { db, schema } from "@/server/db";
import { markNotificationsRead } from "@/server/services/activities";

export const metadata = { title: "Notifications" };

async function markAll() {
  "use server";
  const u = await getCurrentUser();
  if (u) await markNotificationsRead(u.id);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <PageHead title="Notifications">
        {unread ? (
          <form action={markAll}>
            <button type="submit" className="btn btn-ghost">Mark all {unread} as read</button>
          </form>
        ) : null}
      </PageHead>
      <section className="card">
        {rows.length ? (
          rows.map((n) => (
            <div className="list-row" key={n.id} style={{ opacity: n.readAt ? 0.7 : 1 }}>
              <span className="dot" style={{ background: n.readAt ? "var(--line)" : "var(--orange)" }} aria-hidden="true" />
              <div style={{ flexGrow: 1 }}>
                {n.link ? <Link href={n.link} style={{ color: "var(--ink)" }}>{n.title}</Link> : n.title}
                {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
              </div>
              <span className="muted mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
            </div>
          ))
        ) : (
          <Empty title="No notifications yet" />
        )}
      </section>
    </>
  );
}
