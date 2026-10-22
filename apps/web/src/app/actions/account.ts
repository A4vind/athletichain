"use server";

import type { ActionState } from "@/components/action-form";
import { getCurrentUser } from "@/server/auth/current-user";
import { runAction } from "@/server/lib/action";
import { AppError } from "@/server/lib/errors";
import { changePassword } from "@/server/services/auth";
import { passwordChangeSchema } from "@/server/validators/forms";

/** Any signed-in user (coach or admin) changes their own password. */
export async function changeOwnPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(form, passwordChangeSchema, async ({ current, password }) => {
    const u = await getCurrentUser();
    if (!u) throw new AppError("UNAUTHORIZED", "Your session has ended. Log in again.");
    await changePassword(u.id, current, password);
    return "Password updated.";
  });
}
