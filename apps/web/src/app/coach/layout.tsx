import { RoleShell } from "@/components/role-shell";
import { Empty, PageHead } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";
// Verifying and anchoring waits for a blockchain receipt; give serverless functions room for that.
export const maxDuration = 60;

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("COACH");
  return (
    <RoleShell roles={["COACH"]}>
      {user.status === "PENDING_APPROVAL" ? (
        <>
          <PageHead kicker="Coach account" title="Awaiting approval" />
          <Empty title="An academy admin needs to approve your account">
            <span>Until then you can&apos;t see athletes or verify records. You&apos;ll get a notification as soon as you&apos;re approved.</span>
          </Empty>
        </>
      ) : (
        children
      )}
    </RoleShell>
  );
}
