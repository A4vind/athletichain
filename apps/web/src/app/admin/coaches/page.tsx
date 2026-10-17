import { PageHead } from "@/components/ui";
import { adminDashboard } from "@/server/services/dashboards";
import { PendingCoaches } from "../pending-coaches";

export const metadata = { title: "Coach approvals" };

export default async function CoachApprovals() {
  const { pendingCoaches } = await adminDashboard();
  return (
    <>
      <PageHead kicker="Admin" title="Coach approvals" />
      <section className="card">
        <PendingCoaches rows={pendingCoaches} />
      </section>
    </>
  );
}
