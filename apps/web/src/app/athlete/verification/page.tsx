import Link from "next/link";
import { sql } from "drizzle-orm";
import { ActionForm, F } from "@/components/action-form";
import { RecordsTable } from "@/components/records";
import { Empty, PageHead, Tile } from "@/components/ui";
import { disputeAction } from "@/app/actions/records";
import { db } from "@/server/db";
import { athleteContext } from "@/server/services/athlete-context";
import { listRecords } from "@/server/services/records";

export const metadata = { title: "Verification" };

export default async function AthleteVerification() {
  const { athlete } = await athleteContext();
  const records = await listRecords(sql`a.id = ${athlete.id} and vr.status <> 'DRAFT'`);
  const reasons = new Map(
    (
      (await db.execute(sql`
        select vr.public_id, r.reason, exists(select 1 from disputes d where d.record_id = vr.id and d.status = 'OPEN') as disputed
        from verification_requests r join verifiable_records vr on vr.id = r.record_id
        where r.decision = 'REJECTED' and vr.status = 'REJECTED'`)).rows as { public_id: string; reason: string; disputed: boolean }[]
    ).map((r) => [r.public_id, r]),
  );
  const count = (s: string) => records.filter((r) => r.status === s).length;

  return (
    <>
      <PageHead kicker="Your records and their proofs" title="Verification" />
      <section className="tiles">
        <Tile label="Pending review" value={count("PENDING")} />
        <Tile label="Coach verified" value={count("VERIFIED") + count("ANCHORED")} />
        <Tile dark label="Blockchain anchored" value={count("ANCHORED")} />
        <Tile label="Rejected" value={count("REJECTED")} />
        {count("INTEGRITY_WARNING") ? <Tile label="Integrity warnings" value={count("INTEGRITY_WARNING")} subTone="warn" sub="Contact your academy" /> : null}
      </section>
      <section className="card">
        <div className="card-head"><h2>All records</h2><span className="muted" style={{ fontSize: 13 }}>Open a record to run a live integrity check</span></div>
        {records.length ? <RecordsTable records={records} linkBase="/records" /> : <Empty title="Nothing submitted yet"><Link href="/athlete/performance">Report a result</Link></Empty>}
      </section>
      {[...reasons.values()].filter((r) => records.some((x) => x.publicId === r.public_id)).map((r) => (
        <section className="card" key={r.public_id}>
          <div className="card-head"><h2>Rejected · <span className="mono">{r.public_id}</span></h2></div>
          <p style={{ margin: "0 0 12px" }}>Coach&apos;s reason: &ldquo;{r.reason}&rdquo;</p>
          {r.disputed ? (
            <div className="alert alert-info">Your dispute is with the academy admin.</div>
          ) : (
            <ActionForm action={disputeAction} submitLabel="Raise a dispute" submitClass="btn btn-ghost">
              <input type="hidden" name="publicId" value={r.public_id} />
              <F label="Why is the rejection wrong?" name="reason"><textarea id="reason" name="reason" rows={2} className="input" /></F>
            </ActionForm>
          )}
        </section>
      ))}
    </>
  );
}
