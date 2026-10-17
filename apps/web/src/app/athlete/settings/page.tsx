import { Icon } from "@/components/icons";
import { ActionForm, F, Row } from "@/components/action-form";
import { PageHead, fmtDate } from "@/components/ui";
import { athleteContext } from "@/server/services/athlete-context";
import { ageOn } from "@/server/validators/auth";
import { changePasswordAction } from "../actions";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { user, athlete } = await athleteContext();
  const age = ageOn(athlete.dateOfBirth, new Date().toISOString().slice(0, 10));
  return (
    <>
      <PageHead kicker="Account" title="Settings" />
      <section className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, fontSize: 15 }}>
        <div><div className="muted" style={{ fontSize: 12 }}>Name</div>{user.fullName}</div>
        <div><div className="muted" style={{ fontSize: 12 }}>Email</div>{user.email}</div>
        <div><div className="muted" style={{ fontSize: 12 }}>Athlete code</div><span className="mono">{athlete.publicCode}</span></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Age</div>{age}</div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Guardian consent</h2></div>
        {age >= 18 ? (
          <p style={{ margin: 0 }}>Not needed — you&apos;re 18 or older.</p>
        ) : athlete.guardianConsentAt ? (
          <p style={{ margin: 0 }}><span className="badge badge-verified"><Icon name="check" size={14} />Recorded</span> {athlete.guardianName ?? "Your guardian"} gave consent on {fmtDate(athlete.guardianConsentAt.toISOString().slice(0, 10))}. You can share verified records.</p>
        ) : (
          <p style={{ margin: 0 }}><span className="badge badge-pending">Waiting</span> Your academy admin records consent from {athlete.guardianName ?? "your guardian"} ({athlete.guardianEmail ?? "no email on file"}). Until then sharing is off.</p>
        )}
      </section>
      <section className="card">
        <div className="card-head"><h2>Change password</h2></div>
        <ActionForm action={changePasswordAction} submitLabel="Update password">
          <Row>
            <F label="Current password" name="current"><input id="current" name="current" type="password" autoComplete="current-password" className="input" /></F>
            <F label="New password" name="password" hint="8+ characters, a letter and a number"><input id="password" name="password" type="password" autoComplete="new-password" className="input" /></F>
            <F label="Confirm" name="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" /></F>
          </Row>
        </ActionForm>
      </section>
    </>
  );
}
