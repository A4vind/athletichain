import { changeOwnPasswordAction } from "@/app/actions/account";
import { ActionForm, F, Row } from "./action-form";

/** "Change password" card used on the coach and admin settings pages. */
export function PasswordCard() {
  return (
    <section className="card" aria-labelledby="pw-h">
      <div className="card-head"><h2 id="pw-h">Change password</h2></div>
      <ActionForm action={changeOwnPasswordAction} submitLabel="Update password">
        <Row>
          <F label="Current password" name="current"><input id="current" name="current" type="password" autoComplete="current-password" className="input" /></F>
          <F label="New password" name="password" hint="8+ characters, a letter and a number"><input id="password" name="password" type="password" autoComplete="new-password" className="input" /></F>
          <F label="Confirm" name="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" /></F>
        </Row>
      </ActionForm>
    </section>
  );
}

/** One labelled value in the account details card. */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
}
