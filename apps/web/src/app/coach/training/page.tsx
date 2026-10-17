import { SessionForm } from "@/components/forms";
import { SessionsTable } from "@/components/tables";
import { Empty, PageHead } from "@/components/ui";
import { coachContext } from "@/server/services/coach-context";
import { sessionsForCoach } from "@/server/services/queries";
import { addSessionAction } from "../actions";

export const metadata = { title: "Training" };

export default async function CoachTraining() {
  const { coach, athletes, teams } = await coachContext();
  const sessions = await sessionsForCoach(coach.id);
  return (
    <>
      <PageHead kicker="Coach" title="Training" />
      <section className="card">
        <div className="card-head"><h2>Log a session</h2></div>
        {athletes.length ? <SessionForm action={addSessionAction} athletes={athletes} teams={teams} /> : <Empty title="No athletes assigned yet" />}
      </section>
      <section className="card">
        <div className="card-head"><h2>Recent sessions</h2></div>
        <SessionsTable rows={sessions} />
      </section>
    </>
  );
}
