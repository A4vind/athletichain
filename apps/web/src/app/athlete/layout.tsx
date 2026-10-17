import { RoleShell } from "@/components/role-shell";

export const dynamic = "force-dynamic";
// Verifying and anchoring waits for a blockchain receipt; give serverless functions room for that.
export const maxDuration = 60;

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell roles={["ATHLETE"]}>{children}</RoleShell>;
}
