import { describe, expect, it } from "vitest";
import { ageOn, isRealDate, loginSchema, registerSchema, resetSchema } from "./auth";

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

  it("checks the athlete's date of birth", () => {
    const dob = (dateOfBirth: string) => registerSchema.safeParse({ ...base, role: "ATHLETE", dateOfBirth, guardianEmail: "p@example.com" });
    const message = (d: string) => dob(d).error?.issues[0].message;
    const year = new Date().getUTCFullYear();
    expect(message(`${year + 3}-05-01`)).toBe("Date of birth can't be in the future");
    expect(message(new Date().toISOString().slice(0, 10))).toBe("Athletes must be at least 5 years old");
    expect(message(`${year - 2}-01-01`)).toBe("Athletes must be at least 5 years old");
    expect(message("1850-01-01")).toBe("Athletes must be 60 or younger (retirement age)");
    expect(message(`${year - 65}-01-01`)).toBe("Athletes must be 60 or younger (retirement age)");
    expect(dob(`${year - 59}-01-01`).success).toBe(true);
    expect(message("2010-02-31")).toBe("Enter a real date");
    expect(message("2010-13-01")).toBe("Enter a real date");
    expect(dob("2012-02-29").success).toBe(true); // leap day exists
    expect(dob("2000-01-01").success).toBe(true);
    expect(isRealDate("2011-02-29")).toBe(false);
  });

  it("computes age on a given day", () => {
    expect(ageOn("2008-10-08", "2026-10-07")).toBe(17);
    expect(ageOn("2008-10-07", "2026-10-07")).toBe(18);
  });

  it("checks that reset passwords match", () => {
    expect(resetSchema.safeParse({ token: "x".repeat(30), password: "Sprint2026", confirm: "Sprint2027" }).success).toBe(false);
  });
});
