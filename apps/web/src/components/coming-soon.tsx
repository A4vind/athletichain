import { Empty, PageHead } from "./ui";

/** A route that exists in the plan but is built in a later phase. Says so plainly. */
export function ComingInPhase({ title, phase, what }: { title: string; phase: number; what: string }) {
  return (
    <>
      <PageHead title={title} />
      <Empty title={`Built in Phase ${phase}`}>
        <span>{what}</span>
      </Empty>
    </>
  );
}
