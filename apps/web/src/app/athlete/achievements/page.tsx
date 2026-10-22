import { AchievementForm } from "@/components/forms";
import { AchievementsTable } from "@/components/tables";
import { PageHead } from "@/components/ui";
import { submitExistingAction } from "@/app/actions/records";
import { athleteContext } from "@/server/services/athlete-context";
import { achievementsFor } from "@/server/services/queries";
import { selfAchievementAction } from "../actions";

export const metadata = { title: "Achievements" };

export default async function AthleteAchievements() {
  const { athlete, metrics } = await athleteContext();
  const rows = await achievementsFor([athlete.id]);
  return (
    <>
      <PageHead kicker="Tournaments, awards and milestones" title="Achievements" />
      <section className="card">
        <div className="card-head"><h2>Add an achievement</h2></div>
        <AchievementForm action={selfAchievementAction} fixedAthlete={athlete.id} sportCode={metrics[0]?.sport_code} submitLabel="Send to my coach for verification" />
      </section>
      <section className="card"><AchievementsTable rows={rows} submitAction={submitExistingAction} /></section>
    </>
  );
}
