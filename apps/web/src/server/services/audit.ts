import { db, schema } from "@/server/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Records an important event. Never pass passwords, tokens or salts in old/new values. */
export async function audit(
  entry: { actorId: string | null; action: string; entity: string; entityId?: string | null; oldValue?: unknown; newValue?: unknown; ip?: string | null },
  tx: Tx | typeof db = db,
) {
  await tx.insert(schema.auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    ip: entry.ip && /^[0-9a-f.:]+$/i.test(entry.ip) ? entry.ip : null,
  });
}
