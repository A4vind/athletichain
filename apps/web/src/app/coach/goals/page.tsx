import { GoalForm } from "@/components/forms";
import { GoalsTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { coachContext } from "@/server/services/coach-context";
import { goalsFor } from "@/server/services/queries";
import { addGoalAction, goalStatusAction } from "../actions";

export const metadata = { title: "Goals" };

export default async function CoachGoals() {
  const { athletes, metrics } = await coachContext();
  const goals = await goalsFor(athletes.map((a) => a.id));
  const done = goals.filter((g) => g.status === "ACHIEVED").length;
  return (
    <>
      <PageHead kicker={`${goals.filter((g) => g.status === "ACTIVE").length} active · ${done} achieved`} title="Goals" />
      <section className="card">
        <div className="card-head"><h2>Set a goal</h2></div>
        <GoalForm action={addGoalAction} athletes={athletes} metrics={metrics} />
      </section>
      <section className="card">
        <div className="card-head"><h2>All goals</h2></div>
        <GoalsTable rows={goals} showAthlete statusAction={goalStatusAction} />
      </section>
    </>
  );
}
