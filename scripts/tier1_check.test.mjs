import { describe, it, expect } from "vitest";
import {
  rank,
  downgradeConfidence,
  daysSinceAnalysis,
  computeWeeklyBias,
  meaningfulChange,
} from "./tier1_check.mjs";

// Importing this module must NOT trigger a live nightly run (main() is
// guarded behind an entry-point check) — if that guard ever regresses,
// every test in this file will hang or fail on a real network call instead
// of running instantly, which is itself a useful signal.

describe("rank", () => {
  it("ranks terminal/unknown stages as -1", () => {
    expect(rank("INSUFFICIENT_DATA")).toBe(-1);
    expect(rank("NO_C1")).toBe(-1);
    expect(rank("UNKNOWN_DIRECTION")).toBe(-1);
    expect(rank("something-not-in-the-table")).toBe(-1);
  });

  it("ranks progression stages in increasing order", () => {
    expect(rank("C1_ONLY")).toBeLessThan(rank("C2_FORMING"));
    expect(rank("C2_FORMING")).toBeLessThan(rank("C2_CONFIRMED"));
    expect(rank("C2_CONFIRMED")).toBeLessThan(rank("C3_FORMING"));
    expect(rank("C3_FORMING")).toBeLessThan(rank("C3_CISD_CONFIRMED"));
  });
});

describe("downgradeConfidence", () => {
  it("downgrades HIGH to MEDIUM and MEDIUM to LOW", () => {
    expect(downgradeConfidence("HIGH")).toBe("MEDIUM");
    expect(downgradeConfidence("MEDIUM")).toBe("LOW");
  });
  it("LOW stays LOW (floor, not further downgraded)", () => {
    expect(downgradeConfidence("LOW")).toBe("LOW");
  });
  it("passes through falsy/unrecognized values unchanged", () => {
    expect(downgradeConfidence(null)).toBeNull();
    expect(downgradeConfidence(undefined)).toBeUndefined();
  });
});

describe("daysSinceAnalysis", () => {
  it("treats a missing dataAsOf as maximally stale", () => {
    expect(daysSinceAnalysis(null)).toBe(Infinity);
    expect(daysSinceAnalysis(undefined)).toBe(Infinity);
  });
  it("treats an unparseable date string as maximally stale", () => {
    expect(daysSinceAnalysis("not a date")).toBe(Infinity);
  });
  it("computes whole days since a valid past date", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(daysSinceAnalysis(tenDaysAgo)).toBe(10);
  });
});

describe("computeWeeklyBias", () => {
  it("returns null with fewer than 8 weekly candles", () => {
    const candles = Array.from({ length: 7 }, (_, i) => ({ c: 100 + i }));
    expect(computeWeeklyBias(candles)).toBeNull();
  });
  it("returns bull when the 8-week change exceeds +2%", () => {
    const candles = Array.from({ length: 8 }, (_, i) => ({ c: 100 }));
    candles[7] = { c: 105 }; // +5% vs candles[0]
    expect(computeWeeklyBias(candles)).toBe("bull");
  });
  it("returns bear when the 8-week change is below -2%", () => {
    const candles = Array.from({ length: 8 }, () => ({ c: 100 }));
    candles[7] = { c: 95 }; // -5%
    expect(computeWeeklyBias(candles)).toBe("bear");
  });
  it("returns neutral within the ±2% band", () => {
    const candles = Array.from({ length: 8 }, () => ({ c: 100 }));
    candles[7] = { c: 101 }; // +1%
    expect(computeWeeklyBias(candles)).toBe("neutral");
  });
});

describe("meaningfulChange", () => {
  it("first check (no prior state) always counts as changed", () => {
    const r = meaningfulChange(null, { stage: "C1_ONLY" });
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/first check/);
  });

  it("stage advancing counts as changed", () => {
    const r = meaningfulChange({ stage: "C1_ONLY" }, { stage: "C2_CONFIRMED" });
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/advanced/);
  });

  it("stage regressing counts as changed", () => {
    const r = meaningfulChange({ stage: "C3_CISD_CONFIRMED" }, { stage: "C1_ONLY" });
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/flipped backward/);
  });

  it("invalidation flipping false to true counts as changed", () => {
    const r = meaningfulChange(
      { stage: "C2_CONFIRMED", invalidated: false },
      { stage: "C2_CONFIRMED", invalidated: true }
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/invalidation flipped/);
  });

  it("invalidation flipping true to false does NOT by itself count as changed", () => {
    const r = meaningfulChange(
      { stage: "C2_CONFIRMED", invalidated: true },
      { stage: "C2_CONFIRMED", invalidated: false }
    );
    expect(r.changed).toBe(false);
  });

  it("confidence changing counts as changed", () => {
    const r = meaningfulChange(
      { stage: "C3_CISD_CONFIRMED", confidence: "HIGH" },
      { stage: "C3_CISD_CONFIRMED", confidence: "MEDIUM" }
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/confidence changed/);
  });

  it("weekly conflict appearing counts as changed", () => {
    const r = meaningfulChange(
      { stage: "C2_CONFIRMED", weeklyConflict: false },
      { stage: "C2_CONFIRMED", weeklyConflict: true }
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/weekly bias now conflicts/);
  });

  it("weekly conflict resolving counts as changed", () => {
    const r = meaningfulChange(
      { stage: "C2_CONFIRMED", weeklyConflict: true },
      { stage: "C2_CONFIRMED", weeklyConflict: false }
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toMatch(/conflict resolved/);
  });

  it("identical state counts as no change", () => {
    const state = { stage: "C2_CONFIRMED", invalidated: false, confidence: "MEDIUM", weeklyConflict: false };
    const r = meaningfulChange(state, { ...state });
    expect(r.changed).toBe(false);
    expect(r.reason).toMatch(/no meaningful change/);
  });
});
