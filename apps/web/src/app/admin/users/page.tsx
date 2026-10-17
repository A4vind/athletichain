import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Empty, PageHead } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { adminDashboard } from "@/server/services/dashboards";
import { toggleSuspendAction } from "../actions";

export const metadata = { title: "Users" };

const STATUS: Record<string, string> = { ACTIVE: "badge-verified", PENDING_APPROVAL: "badge-pending", SUSPENDED: "badge-rejected" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string }> }) {
  const me = await requireUser("ADMIN");
  const { users: all } = await adminDashboard();
  const { q = "", role = "", status = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const users = all.filter(
    (u) => (!role || u.role === role) && (!status || u.status === status) && (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)),
  );
  return (
    <>
      <PageHead kicker={`${all.length} accounts`} title="Users" />
      <form method="get" className="card" role="search" aria-label="Filter users" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: 14 }}>
        <div className="field" style={{ flex: "2 1 220px" }}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Name or email" />
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="role">Role</label>
          <select id="role" name="role" className="input" defaultValue={role}>
            <option value="">All roles</option><option value="ATHLETE">Athletes</option><option value="COACH">Coaches</option><option value="ADMIN">Admins</option>
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={status}>
            <option value="">Any status</option><option value="ACTIVE">Active</option><option value="PENDING_APPROVAL">Awaiting approval</option><option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary"><Icon name="search" size={18} />Filter</button>
          {q || role || status ? <a href="/admin/users" className="btn btn-ghost">Clear</a> : null}
        </div>
      </form>
      <section className="card">
        <div className="card-head" style={{ marginBottom: 6 }}><h2>{users.length === all.length ? "All users" : `${users.length} of ${all.length} users`}</h2></div>
        {users.length ? (
        <div className="table-wrap">
          <table className="data stack-sm">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="lead"><strong>{u.name}</strong><div className="muted break" style={{ fontSize: 12.5 }}>{u.email}</div></td>
                  <td data-label="Role">{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</td>
                  <td data-label="Status"><span className={`badge ${STATUS[u.status]}`}>{u.status.replace("_", " ").toLowerCase()}</span></td>
                  <td data-label="Last sign-in" className="mono" style={{ fontSize: 13 }}>{u.last_login ?? "—"}</td>
                  <td data-label="" style={{ textAlign: "right" }}>
                    {u.role !== "ADMIN" && u.id !== me.id && u.status !== "PENDING_APPROVAL" ? (
                      <ActionForm
                        action={toggleSuspendAction}
                        submitLabel={u.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                        submitClass={`btn btn-sm ${u.status === "SUSPENDED" ? "btn-ghost" : "btn-danger"}`}
                        confirm={u.status === "SUSPENDED" ? undefined : `Suspend ${u.name}? They are signed out on their next page load${u.role === "COACH" ? " and their wallet is revoked as a verifier" : ""}.`}
                        inlineSubmit
                        keepOnSuccess
                        style={{ justifyContent: "flex-end" }}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="suspend" value={u.status === "SUSPENDED" ? "0" : "1"} />
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <Empty title="No users match these filters" icon="search" />
        )}
      </section>
    </>
  );
}
