import { describe, expect, it } from "vitest";
import { ageOn, loginSchema, registerSchema, resetSchema } from "./auth";

const base = { fullName: "Test Athlete", email: "Test@Example.com", password: "Sprint2026", sportCode: "ATHLETICS" };

describe("auth validators", () => {
  it("normalises email to lower case", () => {
    expect(loginSchema.parse({ email: " Rahul@AthletiChain.dev ", password: "x" }).email).toBe("rahul@athletichain.dev");
  });

  it("requires a letter and a number in passwords", () => {
    expect(registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth: "2000-01-01", password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth: "2000-01-01", password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth: "2000-01-01" }).success).toBe(true);
  });

  it("needs a guardian email for under-18 athletes", () => {
    const minor = registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth: "2015-01-01" });
    expect(minor.success).toBe(false);
    expect(minor.error?.issues[0].path).toEqual(["guardianEmail"]);
    expect(registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth: "2015-01-01", guardianEmail: "p@example.com" }).success).toBe(true);
  });

  it("needs an academy for coaches but no date of birth", () => {
    expect(registerSchema.safeParse({ ...base, role: "COACH" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "COACH", academyId: "6f1c1f9e-2b1a-4c1e-9a0b-1c2d3e4f5a6b" }).success).toBe(true);
  });

  it("computes age on a given day", () => {
    expect(ageOn("2008-10-08", "2026-10-07")).toBe(17);
    expect(ageOn("2008-10-07", "2026-10-07")).toBe(18);
  });

  it("checks that reset passwords match", () => {
    expect(resetSchema.safeParse({ token: "x".repeat(30), password: "Sprint2026", confirm: "Sprint2027" }).success).toBe(false);
  });
});
