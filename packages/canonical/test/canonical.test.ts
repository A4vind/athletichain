import { describe, expect, it } from "vitest";
import {
  buildCanonical,
  canonicalJson,
  combineEvidenceHashes,
  formatValue,
  goalProgress,
  hashRecord,
  isImprovement,
  type CanonicalInput,
} from "../src/index.js";

const EVIDENCE = "8c0c4fed904a7ffc1691f95067a87f21e4b507bd80226e69a71d4e4ce81ac4a0";

const rahul: CanonicalInput = {
  athleteId: "ATH-0007",
  recordType: "PERFORMANCE",
  metric: "time",
  value: 12.4,
  decimals: 2,
  unit: "s",
  date: "2026-09-10",
  verifierId: "COA-0002",
  salt: "3f9c2a7e51b04d18",
  evidenceHashes: [EVIDENCE],
};

describe("canonical hashing", () => {
  it("matches the golden hash from the architecture document", () => {
    expect(hashRecord(rahul)).toBe(
      "1ca1411401e0877a553a2e051b6afed05a9bec02e857d0686a790e60cd0e1009",
    );
  });

  it("detects a tampered value (12.40 -> 12.10)", () => {
    expect(hashRecord({ ...rahul, value: 12.1 })).toBe(
      "122b184a02162f814905e52dec45cb7511aaea15cdeb3b81646647011581036b",
    );
  });

  it("formats numbers with fixed decimals so 12.4 and 12.40 hash the same", () => {
    expect(hashRecord({ ...rahul, value: 12.4 })).toBe(hashRecord({ ...rahul, value: 12.40 }));
    expect(formatValue(12.4, 2)).toBe("12.40");
    expect(formatValue(57, 0)).toBe("57");
  });

  it("is independent of evidence order", () => {
    const other = "a".repeat(64);
    expect(hashRecord({ ...rahul, evidenceHashes: [EVIDENCE, other] })).toBe(
      hashRecord({ ...rahul, evidenceHashes: [other, EVIDENCE] }),
    );
    expect(combineEvidenceHashes(["0x" + other.toUpperCase()])).toBe(other);
  });

  it("changes when evidence is swapped", () => {
    expect(hashRecord({ ...rahul, evidenceHashes: ["b".repeat(64)] })).not.toBe(hashRecord(rahul));
  });

  it("produces sorted, whitespace-free JSON with string values only", () => {
    const json = canonicalJson(buildCanonical(rahul));
    expect(json.startsWith('{"athleteId":"ATH-0007","date":"2026-09-10"')).toBe(true);
    expect(json).not.toMatch(/\s/);
    expect(Object.values(JSON.parse(json)).every((v) => typeof v === "string")).toBe(true);
  });

  it("uses UTC dates", () => {
    expect(buildCanonical({ ...rahul, date: new Date("2026-09-10T23:30:00Z") }).date).toBe("2026-09-10");
  });

  it("rejects bad input", () => {
    expect(() => hashRecord({ ...rahul, salt: "zz" })).toThrow();
    expect(() => hashRecord({ ...rahul, date: "10/09/2026" })).toThrow();
    expect(() => hashRecord({ ...rahul, evidenceHashes: ["abc"] })).toThrow();
  });
});

describe("goal progress", () => {
  it("handles lower-is-better (100m: 12.80 -> 12.30, now 12.40)", () => {
    expect(goalProgress(12.8, 12.4, 12.3)).toBe(80);
  });
  it("handles higher-is-better (runs: 20 -> 50, now 35)", () => {
    expect(goalProgress(20, 35, 50)).toBe(50);
  });
  it("clamps to 0..100", () => {
    expect(goalProgress(12.8, 13.1, 12.3)).toBe(0);
    expect(goalProgress(12.8, 12.0, 12.3)).toBe(100);
  });
  it("knows which way is better", () => {
    expect(isImprovement(12.58, 12.4, "LOWER_IS_BETTER")).toBe(true);
    expect(isImprovement(40, 35, "HIGHER_IS_BETTER")).toBe(false);
  });
});
