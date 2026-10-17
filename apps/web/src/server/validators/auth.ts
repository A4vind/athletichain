import { z } from "zod";

const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const registerSchema = z
  .object({
    role: z.enum(["ATHLETE", "COACH"], { required_error: "Choose athlete or coach" }),
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password,
    sportCode: z.string({ required_error: "Choose a sport" }).min(1, "Choose a sport"),
    academyId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    dateOfBirth: isoDate.optional().or(z.literal("").transform(() => undefined)),
    position: z.string().trim().max(60).optional(),
    guardianName: z.string().trim().max(80).optional(),
    guardianEmail: z.string().trim().toLowerCase().email("Enter a valid guardian email").optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.role === "ATHLETE" && !v.dateOfBirth) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Athletes need a date of birth" });
    }
    if (v.role === "ATHLETE" && v.dateOfBirth && ageOn(v.dateOfBirth, new Date().toISOString().slice(0, 10)) < 18 && !v.guardianEmail) {
      ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "Athletes under 18 need a parent or guardian email" });
    }
    if (v.role === "COACH" && !v.academyId) {
      ctx.addIssue({ code: "custom", path: ["academyId"], message: "Choose your academy" });
    }
  });

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });
export const resetSchema = z
  .object({ token: z.string().min(20), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export type RegisterInput = z.infer<typeof registerSchema>;

export function ageOn(dob: string, onIso: string): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [oy, om, od] = onIso.split("-").map(Number);
  return oy - y - (om < m || (om === m && od < d) ? 1 : 0);
}
