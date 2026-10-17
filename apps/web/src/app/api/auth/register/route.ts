import { startSession, clientIp } from "@/server/auth/cookie";
import { AppError, toErrorResponse } from "@/server/lib/errors";
import { register } from "@/server/services/auth";
import { registerSchema } from "@/server/validators/auth";

export async function POST(req: Request) {
  try {
    const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0].message);
    const user = await register(parsed.data, await clientIp());
    await startSession(user);
    return Response.json({ data: { id: user.id, role: user.role, status: user.status } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
