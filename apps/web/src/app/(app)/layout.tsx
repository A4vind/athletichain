import { RoleShell } from "@/components/role-shell";

export const dynamic = "force-dynamic";
// Verifying and anchoring waits for a blockchain receipt; give serverless functions room for that.
export const maxDuration = 60;

/** Pages every signed-in role can open (record details, notifications). */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell roles={["ATHLETE", "COACH", "ADMIN"]}>{children}</RoleShell>;
}
