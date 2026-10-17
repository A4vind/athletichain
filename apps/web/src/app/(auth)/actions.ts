"use server";

import { redirect } from "next/navigation";
import { clientIp, endSession, startSession } from "@/server/auth/cookie";
import { HOME_FOR_ROLE } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { login, register, requestPasswordReset, resetPassword } from "@/server/services/auth";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/server/validators/auth";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  devLink?: string;
  values?: Record<string, string>;
};

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function formValues(form: FormData, omit: string[] = ["password", "confirm"]) {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !omit.includes(k)) out[k] = v;
  return out;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values: formValues(form) };
  let destination: string;
  try {
    const user = await login(parsed.data.email, parsed.data.password, await clientIp());
    await startSession(user);
    const home = HOME_FOR_ROLE[user.role];
    const next = safeNext(form.get("next"), home);
    destination = next.startsWith(home.split("/").slice(0, 2).join("/")) ? next : home;
  } catch (err) {
    if (err instanceof AppError) return { error: err.message, values: formValues(form) };
    throw err;
  }
  redirect(destination);
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values: formValues(form) };
  let role: "ATHLETE" | "COACH";
  try {
    const user = await register(parsed.data, await clientIp());
    await startSession(user);
    role = parsed.data.role;
  } catch (err) {
    if (err instanceof AppError) return { error: err.message, values: formValues(form) };
    throw err;
  }
  redirect(HOME_FOR_ROLE[role]);
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function forgotAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values: formValues(form) };
  try {
    const link = await requestPasswordReset(parsed.data.email, await clientIp());
    // No mail server in this project: in development the link is shown so the flow can be demonstrated.
    if (link) console.info(`[password reset] ${parsed.data.email}: ${link}`);
    return {
      message: "If that email has an account, a reset link is on its way. It expires in 30 minutes.",
      devLink: process.env.NODE_ENV !== "production" && link ? link : undefined,
    };
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
}

export async function resetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
  redirect("/login?reset=1");
}
