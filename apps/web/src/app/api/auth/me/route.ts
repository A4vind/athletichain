import { getCurrentUser } from "@/server/auth/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: { code: "UNAUTHORIZED", message: "Not signed in" } }, { status: 401 });
  return Response.json({ data: { id: user.id, email: user.email, role: user.role, status: user.status, fullName: user.fullName } });
}
