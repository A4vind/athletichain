import { GoalsTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { athleteContext } from "@/server/services/athlete-context";
import { goalsFor } from "@/server/services/queries";

export const metadata = { title: "Goals" };

export default async function AthleteGoals() {
  const { athlete } = await athleteContext();
  const goals = await goalsFor([athlete.id]);
  return (
    <>
      <PageHead kicker="Set by your coach" title="Goals" />
      <section className="card">
        <GoalsTable rows={goals} />
        <p className="chart-note" style={{ margin: "12px 0 0" }}>Progress = how far you&apos;ve moved from the starting value towards the target, using your latest result. For times, going down counts as progress.</p>
      </section>
    </>
  );
}
