/**
 * Evidence files are never put on-chain. Their SHA-256 goes into the canonical record, so
 * swapping a file after verification breaks the integrity check.
 *
 * Where the bytes live:
 * - BLOB_READ_WRITE_TOKEN set (Vercel): a private Vercel Blob store. The key is saved as "blob:<path>".
 * - otherwise (local): files on disk under STORAGE_DIR. The key is the plain relative path.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/lib/errors";

// Vercel functions accept request bodies up to 4.5 MB, so 4 MB leaves room for the other form fields.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const BLOB_PREFIX = "blob:";
const blobStorageOn = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const storageDir = () => path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "storage");

export function isFile(v: FormDataEntryValue | null): v is File {
  return typeof v === "object" && v !== null && "arrayBuffer" in v && (v as File).size > 0;
}

export async function saveEvidence(recordId: string, file: File, userId: string) {
  if (file.size > MAX_BYTES) throw new AppError("VALIDATION", "Evidence files must be 4 MB or smaller. Try a smaller photo or a compressed PDF.");
  const ext = ALLOWED[file.type];
  if (!ext) throw new AppError("VALIDATION", "Evidence must be a PDF, PNG, JPG or WebP file");
  const vr = await db.query.verifiableRecords.findFirst({ where: eq(schema.verifiableRecords.id, recordId) });
  if (!vr || !["DRAFT", "PENDING", "REJECTED"].includes(vr.status)) {
    throw new AppError("CONFLICT", "Evidence can't be added after a record is verified");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(bytes).digest();
  const rel = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  let key = rel;
  if (blobStorageOn()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`evidence/${rel}`, bytes, { access: "private", contentType: file.type, addRandomSuffix: false });
    key = `${BLOB_PREFIX}${blob.pathname}`;
  } else {
    const full = path.join(storageDir(), rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }
  await db.insert(schema.evidenceFiles).values({
    recordId,
    storageKey: key,
    fileName: file.name.slice(0, 200) || `evidence.${ext}`,
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: sha,
    uploadedBy: userId,
  });
  return sha.toString("hex");
}

export async function readEvidence(id: string) {
  const row = await db.query.evidenceFiles.findFirst({ where: eq(schema.evidenceFiles.id, id) });
  if (!row) throw new AppError("NOT_FOUND", "File not found");
  if (row.storageKey.startsWith(BLOB_PREFIX)) {
    const { get } = await import("@vercel/blob");
    const res = await get(row.storageKey.slice(BLOB_PREFIX.length), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new AppError("NOT_FOUND", "File not found in storage");
    return { row, bytes: Buffer.from(await new Response(res.stream).arrayBuffer()) };
  }
  const full = path.join(storageDir(), row.storageKey);
  if (!full.startsWith(storageDir())) throw new AppError("FORBIDDEN", "Bad path");
  try {
    return { row, bytes: await fs.readFile(full) };
  } catch {
    throw new AppError("NOT_FOUND", "File not found in storage");
  }
}
