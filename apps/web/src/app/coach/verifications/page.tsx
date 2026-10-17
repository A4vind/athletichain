import Link from "next/link";
import { sql } from "drizzle-orm";
import { buildCanonical, canonicalJson, hashRecord } from "@athletichain/canonical";
import { RecordsTable } from "@/components/records";
import { Icon } from "@/components/icons";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { VerifyActions } from "@/components/verify-actions";
import { db } from "@/server/db";
import { coachContext } from "@/server/services/coach-context";
import { canonicalInputFor, listRecords } from "@/server/services/records";

export const metadata = { title: "Verifications" };

export default async function CoachVerifications() {
  const { coach } = await coachContext();
  const queue = await listRecords(sql`vr.status = 'PENDING' and exists (
    select 1 from verification_requests r where r.record_id = vr.id and r.assigned_coach = ${coach.id} and r.decision is null)`);
  const requests = (
    await db.execute(sql`
      select vr.public_id, su.full_name as submitted_by, su.role as submitter_role, to_char(r.created_at, 'YYYY-MM-DD') as submitted_on,
        (select count(*)::int from evidence_files e where e.record_id = vr.id) as evidence,
        (select json_agg(json_build_object('id', e.id, 'name', e.file_name)) from evidence_files e where e.record_id = vr.id) as files,
        (select pr2.value::text from performance_records pr2 join performance_records pr on pr.id = vr.performance_record_id
           join verifiable_records v2 on v2.performance_record_id = pr2.id
          where pr2.athlete_id = pr.athlete_id and pr2.metric_id = pr.metric_id and pr2.recorded_on < pr.recorded_on and v2.status in ('VERIFIED','ANCHORED')
          order by pr2.recorded_on desc limit 1) as previous
      from verification_requests r join verifiable_records vr on vr.id = r.record_id join users su on su.id = r.submitted_by
      where r.assigned_coach = ${coach.id} and r.decision is null`)
  ).rows as { public_id: string; submitted_by: string; submitter_role: string; submitted_on: string; evidence: number; files: { id: string; name: string }[] | null; previous: string | null }[];
  const meta = new Map(requests.map((r) => [r.public_id, r]));
  const recent = await listRecords(sql`vr.verified_by = ${coach.id}`, 10);

  const cards = await Promise.all(
    queue.map(async (r) => {
      const input = await canonicalInputFor(r, coach.publicCode);
      return { r, json: canonicalJson(buildCanonical(input)), hash: hashRecord(input), m: meta.get(r.publicId)! };
    }),
  );

  return (
    <>
      <PageHead kicker={`Coach ${coach.publicCode} · wallet ${coach.walletAddress ? `${coach.walletAddress.slice(0, 6)}…${coach.walletAddress.slice(-4)}` : "not linked"}`} title="Pending verification" />
      {!coach.walletAddress ? <div className="alert alert-warn"><Icon name="wallet" size={18} /><div>Link a wallet on the <Link href="/coach/blockchain">Blockchain</Link> page first. Without one, approvals are coach-verified but not anchored.</div></div> : null}

      {cards.length ? (
        <p className="text-2" style={{ fontSize: 14.5, marginTop: -4 }}>
          {cards.length} {cards.length === 1 ? "record is" : "records are"} waiting, oldest first. Check the evidence, then approve to sign the fingerprint with your wallet, or reject with a reason the athlete will see.
        </p>
      ) : null}
      {cards.length ? (
        cards.map(({ r, json, hash, m }) => (
          <section className="card" key={r.id} aria-labelledby={`h-${r.publicId}`} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  <span className="mono">{r.publicId}</span> · {m.submitter_role === "ATHLETE" ? "self-reported" : `entered by ${m.submitted_by}`} on {fmtDate(m.submitted_on)}
                </div>
                <h2 id={`h-${r.publicId}`} style={{ fontSize: 20, marginTop: 4 }}>{r.athleteName}</h2>
                <div className="text-2" style={{ fontSize: 15 }}>{r.title}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span className="badge badge-pending"><Icon name="clock" size={14} />Pending review</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
              <div className="result" style={{ fontSize: "clamp(38px, 8vw, 52px)" }}>{r.display}</div>
              {m.previous ? (
                <span className="muted" style={{ fontSize: 14 }}>Previous verified: {Number(m.previous).toFixed(r.decimals ?? 2)} {r.unit}</span>
              ) : null}
            </div>
            <div className="kv">
              <div><span>Type</span>{r.kind.charAt(0) + r.kind.slice(1).toLowerCase()}</div>
              <div><span>Date</span>{fmtDate(r.date)}</div>
              <div><span>Event</span>{r.event ?? "—"}</div>
            </div>
            <div>
              <div className="section-title">Evidence</div>
              {m.files?.length ? (
                m.files.map((f) => (
                  <a key={f.id} href={`/api/evidence/${f.id}`} target="_blank" rel="noreferrer" className="list-link" style={{ minHeight: 44 }}>
                    <span className="icon-chip"><Icon name="file" size={18} /></span>
                    <span className="break" style={{ flex: "1 1 auto", fontWeight: 550 }}>{f.name}</span>
                    <Icon name="external" size={16} className="chev" />
                  </a>
                ))
              ) : (
                <div className="alert alert-warn" style={{ padding: "8px 12px" }}><Icon name="warning" size={16} /><div>No evidence attached. Ask the athlete for a result sheet, photo or video before approving.</div></div>
              )}
            </div>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--text-2)", minHeight: 32 }}>
                What you will sign: SHA-256 <span className="mono" style={{ color: "var(--chain)" }}>0x{hash.slice(0, 10)}…{hash.slice(-6)}</span>
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Canonical record: sorted keys, salted, evidence fingerprints included</span>
                <code className="hash">{json}</code>
                <code className="hash chain">0x{hash}</code>
              </div>
            </details>
            <VerifyActions publicId={r.publicId} />
          </section>
        ))
      ) : (
        <Empty title="Nothing waiting for you" icon="check">New submissions from your athletes show up here.</Empty>
      )}

      <section className="card">
        <div className="card-head"><h2>Recently verified by you</h2><Link href="/coach/blockchain" className="link">All <Icon name="chevron" size={14} /></Link></div>
        {recent.length ? <RecordsTable records={recent} showAthlete linkBase="/records" /> : <Empty title="Nothing yet" />}
      </section>
    </>
  );
}
