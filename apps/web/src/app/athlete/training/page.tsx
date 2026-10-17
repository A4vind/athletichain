import { SessionsTable } from "@/components/tables";
import { PageHead, Tile } from "@/components/ui";
import { athleteContext } from "@/server/services/athlete-context";
import { sessionsForAthlete } from "@/server/services/queries";

export const metadata = { title: "Training" };

export default async function AthleteTraining() {
  const { athlete } = await athleteContext();
  const rows = await sessionsForAthlete(athlete.id, 120);
  const present = rows.filter((r) => r.status === "PRESENT");
  const minutes = present.reduce((n, r) => n + r.duration, 0);
  return (
    <>
      <PageHead kicker="Logged by your coach" title="Training history" />
      <section className="tiles">
        <Tile label="Sessions attended" value={present.length} sub={`of ${rows.length} planned`} />
        <Tile label="Attendance" value={`${rows.length ? Math.round((100 * present.length) / rows.length) : 0}%`} />
        <Tile label="Training time" value={`${Math.round(minutes / 60)} h`} />
        <Tile label="High-intensity sessions" value={present.filter((r) => r.intensity === "HIGH").length} />
      </section>
      <section className="card"><SessionsTable rows={rows} perAthlete /></section>
    </>
  );
}
