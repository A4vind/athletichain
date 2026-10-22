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

/** True only for a date that exists on the calendar: refuses 2010-02-31 and 2010-13-01. */
export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Youngest and oldest age accepted for an athlete's date of birth. */
export const MIN_ATHLETE_AGE = 5;
export const MAX_ATHLETE_AGE = 60; // retirement age

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine(isRealDate, "Enter a real date");

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
    if (v.role === "ATHLETE" && v.dateOfBirth && isRealDate(v.dateOfBirth)) {
      const today = new Date().toISOString().slice(0, 10);
      const age = ageOn(v.dateOfBirth, today);
      if (v.dateOfBirth > today) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth can't be in the future" });
      } else if (age < MIN_ATHLETE_AGE) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: `Athletes must be at least ${MIN_ATHLETE_AGE} years old` });
      } else if (age > MAX_ATHLETE_AGE) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: `Athletes must be ${MAX_ATHLETE_AGE} or younger (retirement age)` });
      } else if (age < 18 && !v.guardianEmail) {
        ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "Athletes under 18 need a parent or guardian email" });
      }
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
