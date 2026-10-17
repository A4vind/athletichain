import { PerformanceForm } from "@/components/forms";
import { PerformanceTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { coachContext } from "@/server/services/coach-context";
import { performanceFor } from "@/server/services/queries";
import { addPerformanceAction } from "../actions";

export const metadata = { title: "Performance" };

export default async function CoachPerformance() {
  const { athletes, metrics } = await coachContext();
  const rows = await performanceFor(athletes.map((a) => a.id), 60);
  return (
    <>
      <PageHead kicker="Coach" title="Performance" />
      <section className="card">
        <div className="card-head"><h2>Add a result</h2></div>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>
          Results you enter count as coach-entered. To have one anchored on-chain, send it for verification: it goes to another coach at your academy, because nobody verifies their own entry.
        </p>
        <PerformanceForm action={addPerformanceAction} athletes={athletes} metrics={metrics} submitLabel="Send to another coach for verification" />
      </section>
      <section className="card">
        <div className="card-head"><h2>Latest results across your athletes</h2></div>
        <PerformanceTable rows={rows} showAthlete />
      </section>
    </>
  );
}
