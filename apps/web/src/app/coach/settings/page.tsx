import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { Detail, PasswordCard } from "@/components/password-card";
import { PageHead, Tile, fmtDate } from "@/components/ui";
import { db, schema } from "@/server/db";
import { coachContext } from "@/server/services/coach-context";

export const metadata = { title: "Profile & settings" };

export default async function CoachSettings() {
  const { user, coach, athletes } = await coachContext();
  const [academy, sport] = await Promise.all([
    coach.academyId ? db.query.academies.findFirst({ where: eq(schema.academies.id, coach.academyId) }) : null,
    coach.sportId ? db.query.sports.findFirst({ where: eq(schema.sports.id, coach.sportId) }) : null,
  ]);
  const counts = (
    await db.execute(sql`
      select count(*) filter (where status in ('VERIFIED','ANCHORED','INTEGRITY_WARNING'))::int as verified,
             count(*) filter (where status = 'ANCHORED')::int as anchored
      from verifiable_records where verified_by = ${coach.id}`)
  ).rows[0] as { verified: number; anchored: number };

  return (
    <>
      <PageHead kicker={`Coach ${coach.publicCode}`} title="Profile & settings" />

      <section className="card" aria-labelledby="acc-h">
        <div className="card-head"><h2 id="acc-h">Your account</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14, fontSize: 15 }}>
          <Detail label="Name">{user.fullName}</Detail>
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Coach code"><span className="mono">{coach.publicCode}</span></Detail>
          <Detail label="Academy">{academy ? `${academy.name}${academy.city ? `, ${academy.city}` : ""}` : "—"}</Detail>
          <Detail label="Sport">{sport?.name ?? "—"}</Detail>
          <Detail label="Approved on">{coach.approvedAt ? fmtDate(coach.approvedAt.toISOString().slice(0, 10)) : "—"}</Detail>
        </div>
        <p className="muted" style={{ margin: "14px 0 0", fontSize: 13 }}>
          Your name, email and academy identify who signed your approvals, so only an academy admin can change them.
        </p>
      </section>

      <section className="tiles">
        <Tile label="Athletes" value={athletes.length} href="/coach/athletes" />
        <Tile label="Records you verified" value={counts.verified} href="/coach/blockchain" />
        <Tile dark label="Blockchain anchored" value={counts.anchored} href="/coach/blockchain" />
      </section>

      <section className="card" aria-labelledby="wal-h">
        <div className="card-head"><h2 id="wal-h">Signing wallet</h2></div>
        {coach.walletAddress ? (
          <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Icon name="wallet" size={18} />
            <span className="mono" style={{ overflowWrap: "anywhere" }}>{coach.walletAddress}</span>
            <Link href="/coach/blockchain" style={{ fontSize: 14 }}>Registration status and changing wallet →</Link>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            No wallet linked yet. <Link href="/coach/blockchain">Link MetaMask on the Blockchain page</Link> to anchor the records you approve.
          </p>
        )}
      </section>

      <PasswordCard />
    </>
  );
}
