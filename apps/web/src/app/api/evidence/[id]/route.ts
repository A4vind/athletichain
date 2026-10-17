import { eq } from "drizzle-orm";
import { assertCanView } from "@/server/services/record-access";
import { getCurrentUser } from "@/server/auth/current-user";
import { db, schema } from "@/server/db";
import { toErrorResponse, AppError } from "@/server/lib/errors";
import { readEvidence } from "@/server/services/evidence";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHORIZED", "Log in to view evidence");
    const { row, bytes } = await readEvidence((await params).id);
    const vr = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.id, row.recordId) });
    await assertCanView(user, vr!.publicId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `inline; filename="${row.fileName.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
