import { AchievementForm } from "@/components/forms";
import { AchievementsTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { coachContext } from "@/server/services/coach-context";
import { achievementsFor } from "@/server/services/queries";
import { addAchievementAction } from "../actions";

export const metadata = { title: "Achievements" };

export default async function CoachAchievements() {
  const { athletes } = await coachContext();
  const rows = await achievementsFor(athletes.map((a) => a.id));
  return (
    <>
      <PageHead kicker="Coach" title="Achievements" />
      <section className="card">
        <div className="card-head"><h2>Record an achievement or milestone</h2></div>
        <AchievementForm action={addAchievementAction} athletes={athletes} submitLabel="Send to another coach for verification" />
      </section>
      <section className="card">
        <div className="card-head"><h2>Your athletes&apos; achievements</h2></div>
        <AchievementsTable rows={rows} showAthlete />
      </section>
    </>
  );
}
