import "server-only";
import type { ZodType, ZodTypeDef } from "zod";
import { AppError } from "./errors";

export type ActionState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; data?: unknown; nonce?: number };

/** Parses a FormData with a Zod schema and runs fn, turning known errors into form state. */
export async function runAction<T>(form: FormData, schema: ZodType<T, ZodTypeDef, unknown>, fn: (input: T) => Promise<string | { ok: string; data?: unknown }>): Promise<ActionState> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = v;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { error: Object.values(fieldErrors)[0], fieldErrors, nonce: Date.now() };
  }
  try {
    const out = await fn(parsed.data);
    return typeof out === "string" ? { ok: out, nonce: Date.now() } : { ...out, nonce: Date.now() };
  } catch (err) {
    if (err instanceof AppError) return { error: err.message, nonce: Date.now() };
    console.error(err);
    return { error: "Something went wrong. Please try again.", nonce: Date.now() };
  }
}
