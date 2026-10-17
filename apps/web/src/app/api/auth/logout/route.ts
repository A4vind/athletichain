import { endSession } from "@/server/auth/cookie";

export async function POST() {
  await endSession();
  return Response.json({ data: { ok: true } });
}
