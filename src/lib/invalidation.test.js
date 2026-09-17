import { describe, it, expect } from "vitest";
import { parseInvalidation, checkInvalidation } from "./invalidation.js";

describe("parseInvalidation", () => {
  it("returns null for an empty/falsy string", () => {
    expect(parseInvalidation("")).toBeNull();
    expect(parseInvalidation(null)).toBeNull();
    expect(parseInvalidation(undefined)).toBeNull();
  });

  it("returns null for an 'inside range' invalidation (no external threshold)", () => {
    expect(parseInvalidation("Inside range — no trade. External boundary body close = entry trigger.")).toBeNull();
  });

  it("parses a single 'below $X' threshold", () => {
    const r = parseInvalidation("Daily body close below $2,800 (protected swing violated)");
    expect(r).toEqual([{ direction: "below", price: 2800 }]);
  });

  it("parses a single 'above $X' threshold", () => {
    const r = parseInvalidation("Body close above $65,000 invalidates the setup");
    expect(r).toEqual([{ direction: "above", price: 65000 }]);
  });

  it("parses multiple thresholds in one string", () => {
    const r = parseInvalidation("CALL if above $72,000, PUT if below $65,000");
    expect(r).toEqual([
      { direction: "above", price: 72000 },
      { direction: "below", price: 65000 },
    ]);
  });

  it("is case-insensitive on the direction keyword", () => {
    const r = parseInvalidation("Body close Below $100.50");
    expect(r).toEqual([{ direction: "below", price: 100.5 }]);
  });

  it("handles prices without a dollar sign or comma", () => {
    const r = parseInvalidation("below 26.19");
    expect(r).toEqual([{ direction: "below", price: 26.19 }]);
  });
});

describe("checkInvalidation — consistent return shape", () => {
  // Regression coverage for the threshold/thresholds naming inconsistency:
  // every branch must expose both keys with the same meaning, not just
  // whichever one happened to be set on that particular return path.
  it("no price given: not breached, both threshold and thresholds are null", () => {
    const r = checkInvalidation({ invalidation: "below $100" }, null);
    expect(r).toEqual({ breached: false, threshold: null, thresholds: null });
  });

  it("no invalidation string: not breached, both keys null", () => {
    const r = checkInvalidation({ invalidation: null }, 100);
    expect(r).toEqual({ breached: false, threshold: null, thresholds: null });
  });

  it("price has not crossed the threshold: not breached, thresholds still populated", () => {
    const r = checkInvalidation({ invalidation: "below $100" }, 105);
    expect(r.breached).toBe(false);
    expect(r.threshold).toBeNull();
    expect(r.thresholds).toEqual([{ direction: "below", price: 100 }]);
  });

  it("'below' breach: breached true, threshold set to the breached one, thresholds is the full array", () => {
    const r = checkInvalidation({ invalidation: "below $100" }, 95);
    expect(r.breached).toBe(true);
    expect(r.threshold).toEqual({ direction: "below", price: 100 });
    expect(r.thresholds).toEqual([{ direction: "below", price: 100 }]);
  });

  it("'above' breach: breached true, threshold set correctly", () => {
    const r = checkInvalidation({ invalidation: "above $72,000" }, 73000);
    expect(r.breached).toBe(true);
    expect(r.threshold).toEqual({ direction: "above", price: 72000 });
  });

  it("multiple thresholds: returns the first one actually breached", () => {
    const r = checkInvalidation({ invalidation: "above $72,000 or below $65,000" }, 64000);
    expect(r.breached).toBe(true);
    expect(r.threshold).toEqual({ direction: "below", price: 65000 });
  });

  it("'inside range' string never breaches regardless of price", () => {
    const r = checkInvalidation({ invalidation: "Inside range — no trade." }, 1);
    expect(r).toEqual({ breached: false, threshold: null, thresholds: null });
  });
});
