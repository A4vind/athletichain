import { startSession, clientIp } from "@/server/auth/cookie";
import { AppError, toErrorResponse } from "@/server/lib/errors";
import { login } from "@/server/services/auth";
import { loginSchema } from "@/server/validators/auth";

export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0].message);
    const user = await login(parsed.data.email, parsed.data.password, await clientIp());
    await startSession(user);
    return Response.json({ data: { id: user.id, role: user.role, fullName: user.fullName } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
