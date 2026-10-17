import { TrendChart } from "@/components/charts";
import { PerformanceForm } from "@/components/forms";
import { PerformanceTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { athleteContext } from "@/server/services/athlete-context";
import { performanceFor } from "@/server/services/queries";
import type { TrustLevel } from "@/server/services/dashboards";
import { selfReportAction, submitResultAction } from "../actions";

export const metadata = { title: "Performance" };

export default async function AthletePerformance() {
  const { athlete, metrics } = await athleteContext();
  const rows = await performanceFor([athlete.id], 300);
  const byMetric = new Map<string, typeof rows>();
  for (const r of [...rows].reverse()) byMetric.set(r.metric, [...(byMetric.get(r.metric) ?? []), r]);

  return (
    <>
      <PageHead kicker="All your results" title="Performance">
        <a href="#report" className="btn btn-primary">Report a result</a>
      </PageHead>
      <div className="grid-2">
        {[...byMetric.entries()].filter(([, list]) => list.length >= 2).map(([metric, list]) => (
          <section className="card" key={metric}>
            <div className="card-head"><h2>{metric}</h2></div>
            <TrendChart
              title={metric}
              unit={list[0].unit}
              decimals={list[0].decimals}
              lowerIsBetter={list[0].direction === "LOWER_IS_BETTER"}
              points={list.map((r) => ({
                date: r.date,
                value: Number(r.value),
                trust: (r.status === "ANCHORED" ? "ANCHORED" : r.status === "VERIFIED" || r.source === "COACH_ENTERED" ? "COACH_VERIFIED" : "SELF_REPORTED") as TrustLevel,
              }))}
            />
          </section>
        ))}
      </div>
      <section className="card" id="report" style={{ scrollMarginTop: 80 }}>
        <div className="card-head"><h2>Report a result</h2></div>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 14 }}>It shows as self-reported until your coach verifies it. Attach evidence, such as a result sheet or photo, so your coach can verify it quickly.</p>
        <PerformanceForm action={selfReportAction} fixedAthlete={athlete.id} metrics={metrics} submitLabel="Send to my coach for verification" />
      </section>
      <section className="card">
        <div className="card-head"><h2>Results</h2></div>
        <PerformanceTable rows={rows} submitAction={submitResultAction} />
      </section>
    </>
  );
}
