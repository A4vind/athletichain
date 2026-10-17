import { redirect } from "next/navigation";

/** The landing-page search box posts here. */
export default async function VerifyLookup({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) redirect("/#top");
  redirect(`/verify/${encodeURIComponent(code.startsWith("VR-") ? code : `VR-${code}`)}`);
}
