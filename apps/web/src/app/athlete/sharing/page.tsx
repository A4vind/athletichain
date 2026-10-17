import { desc, eq, sql } from "drizzle-orm";
import { ActionForm, F, Row } from "@/components/action-form";
import { ShareButtons } from "@/components/share-buttons";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { db, schema } from "@/server/db";
import { athleteContext } from "@/server/services/athlete-context";
import { listRecords } from "@/server/services/records";
import { publicUrl, qrSvg } from "@/server/services/sharing";
import { ageOn } from "@/server/validators/auth";
import { revokeShareAction, shareAction } from "../actions";

export const metadata = { title: "Verified profile" };

export default async function Sharing() {
  const { athlete, user } = await athleteContext();
  const minorWithoutConsent = ageOn(athlete.dateOfBirth, new Date().toISOString().slice(0, 10)) < 18 && !athlete.guardianConsentAt;
  const shareable = await listRecords(sql`a.id = ${athlete.id} and vr.status in ('VERIFIED','ANCHORED')`);
  const links = await db.select().from(schema.shareLinks).where(eq(schema.shareLinks.athleteId, athlete.id)).orderBy(desc(schema.shareLinks.createdAt));
  const recordName = new Map(shareable.map((r) => [r.id, `${r.title} · ${r.display}`]));
  const active = links.filter((l) => !l.revokedAt && (!l.expiresAt || l.expiresAt > new Date()));
  const qrs = await Promise.all(active.map((l) => qrSvg(l.code)));

  return (
    <>
      <PageHead kicker="Portable verified profile" title="Share your records" />
      <p className="text-2" style={{ margin: 0, maxWidth: 720 }}>
        Give a new coach, academy, scout or organiser a link or QR code. They see your first name and initial, the records you choose, who verified them, and a live check against the blockchain. Never your email, phone or date of birth.
      </p>

      {minorWithoutConsent ? (
        <div className="alert alert-warn">You&apos;re under 18 and your guardian&apos;s consent isn&apos;t recorded yet, so sharing is switched off. Your academy admin can record it.</div>
      ) : (
        <section className="card">
          <div className="card-head"><h2>Create a link</h2></div>
          <ActionForm action={shareAction} submitLabel="Create link and QR">
            <Row>
              <F label="What to share" name="scope">
                <select id="scope" name="scope" className="input" defaultValue="RECORD">
                  <option value="RECORD">One record</option>
                  <option value="PROFILE">My whole verified profile</option>
                </select>
              </F>
              <F label="Record (for one record)" name="publicId">
                <select id="publicId" name="publicId" className="input" defaultValue={shareable[0]?.publicId}>
                  {shareable.map((r) => <option key={r.id} value={r.publicId}>{r.title} · {r.display} · {fmtDate(r.date)}{r.status === "ANCHORED" ? " ⬡" : ""}</option>)}
                </select>
              </F>
              <F label="Expires after" name="expiresInDays">
                <select id="expiresInDays" name="expiresInDays" className="input" defaultValue="90">
                  <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
                </select>
              </F>
            </Row>
          </ActionForm>
        </section>
      )}

      {active.length ? (
        <div className="grid-2">
          {active.map((l, i) => (
            <section className="card" key={l.id} style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div className="qr" role="img" aria-label={`QR code for ${publicUrl(l.code)}`} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
              <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <strong>{l.scope === "PROFILE" ? "Whole verified profile" : recordName.get(l.recordId ?? "") ?? "Record"}</strong>
                <a href={`/verify/${l.code}`} target="_blank" rel="noreferrer" className="mono break" style={{ fontSize: 13 }}>{publicUrl(l.code)}</a>
                <span className="muted" style={{ fontSize: 13 }}>Expires {fmtDate(l.expiresAt?.toISOString().slice(0, 10))} · opened {l.viewCount} {l.viewCount === 1 ? "time" : "times"}</span>
                <ShareButtons url={publicUrl(l.code)} title={`${user.fullName.split(" ")[0]}'s verified record on AthletiChain`} />
                <ActionForm action={revokeShareAction} submitLabel="Revoke link" submitClass="btn btn-danger btn-sm" inlineSubmit confirm="Revoke this link? Anyone who opens it will see that it was withdrawn.">
                  <input type="hidden" name="linkId" value={l.id} />
                </ActionForm>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty title="No active links" icon="qr">Create a link above to get a QR code you can print or send.</Empty>
      )}

      {links.length > active.length ? (
        <section className="card">
          <div className="card-head"><h2>Expired or revoked</h2></div>
          {links.filter((l) => !active.includes(l)).map((l) => (
            <div className="list-row" key={l.id}>
              <span className="mono" style={{ flexGrow: 1 }}>{l.code}</span>
              <span className="muted">{l.revokedAt ? `revoked ${fmtDate(l.revokedAt.toISOString().slice(0, 10))}` : "expired"}</span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
