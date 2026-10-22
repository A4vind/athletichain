import { z } from "zod";
import { isRealDate } from "./auth";

const today = () => new Date().toISOString().slice(0, 10);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").refine(isRealDate, "Enter a real date");
const pastDate = isoDate.refine((d) => d <= today(), "Date can't be in the future");
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const num = (label: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number({ invalid_type_error: `${label} must be a number`, required_error: `Enter ${label.toLowerCase()}` }).finite());

export const performanceSchema = z.object({
  athleteId: z.string().uuid().optional(),
  metricId: z.string().uuid("Choose a metric"),
  value: num("Value").refine((v) => v >= 0 && v < 1_000_000, "Value looks wrong"),
  recordedOn: pastDate,
  eventName: optText(120),
  conditions: optText(120),
  notes: optText(500),
  submit: checkbox,
});

export const achievementSchema = z.object({
  athleteId: z.string().uuid().optional(),
  kind: z.enum(["ACHIEVEMENT", "MILESTONE"]),
  title: z.string().trim().min(2, "Enter a title").max(120),
  eventName: optText(160),
  result: z.string().trim().min(1, "Enter the result or position").max(80),
  achievedOn: pastDate,
  description: optText(500),
  submit: checkbox,
});

export const sessionSchema = z.object({
  teamId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  sessionDate: isoDate,
  type: z.string().trim().min(2, "Enter the training type").max(80),
  durationMin: num("Duration").refine((v) => Number.isInteger(v) && v > 0 && v <= 600, "Duration must be 1–600 minutes"),
  intensity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  exercises: optText(500),
  notes: optText(500),
});

export const goalSchema = z.object({
  athleteId: z.string().uuid("Choose an athlete"),
  metricId: z.string().uuid("Choose a metric"),
  title: z.string().trim().min(3, "Enter a goal").max(120),
  startValue: num("Starting value"),
  targetValue: num("Target"),
  deadline: isoDate.refine((d) => d >= today(), "Deadline must be today or later"),
});

export const feedbackSchema = z.object({
  athleteId: z.string().uuid(),
  body: z.string().trim().min(3, "Write some feedback").max(1000),
});

export const rejectSchema = z.object({ publicId: z.string().min(3), reason: z.string().trim().min(5, "Tell the athlete why (at least 5 characters)").max(500) });

export const shareSchema = z.object({
  scope: z.enum(["RECORD", "PROFILE"]),
  publicId: z.string().optional(),
  expiresInDays: z.enum(["7", "30", "90", "365"]).transform(Number),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const transferSchema = z.object({ athleteId: z.string().uuid(), coachId: z.string().uuid("Choose a coach"), teamId: z.string().uuid("Choose a team") });
export const academySchema = z.object({ name: z.string().trim().min(3).max(120), city: optText(80) });
export const teamSchema = z.object({ academyId: z.string().uuid(), sportId: z.string().uuid(), name: z.string().trim().min(2).max(80) });
export const metricSchema = z.object({
  sportId: z.string().uuid(),
  code: z.string().trim().regex(/^[a-z0-9_]{2,30}$/, "Lowercase letters, digits and _ only"),
  name: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(20),
  direction: z.enum(["LOWER_IS_BETTER", "HIGHER_IS_BETTER"]),
  decimals: num("Decimals").refine((v) => Number.isInteger(v) && v >= 0 && v <= 3, "0–3"),
  isAnchorable: checkbox,
});
