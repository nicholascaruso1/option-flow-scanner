import { describe, it, expect } from "vitest";
import { detectC123 } from "./detectC123.js";

// Every fixture below was verified interactively against the real function
// output before being committed here — these are not hand-guessed values.

describe("detectC123 — insufficient data", () => {
  it("returns INSUFFICIENT_DATA for fewer than 5 candles", () => {
    const r = detectC123([{ o: 1, h: 2, l: 0, c: 1.5 }], "bull");
    expect(r.detected).toBe(false);
    expect(r.stage).toBe("INSUFFICIENT_DATA");
  });

  it("returns UNKNOWN_DIRECTION for an unrecognized direction string", () => {
    const candles = Array.from({ length: 5 }, () => ({ o: 1, h: 2, l: 0, c: 1.5 }));
    const r = detectC123(candles, "sideways");
    expect(r.stage).toBe("UNKNOWN_DIRECTION");
  });
});

describe("detectC123 — bull direction", () => {
  it("NO_C1: no bearish leg from the swing high", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 106, l: 104, c: 105.5 },
      { o: 105.5, h: 107, l: 105, c: 106 },
      { o: 106, h: 108, l: 105.5, c: 107 },
      { o: 107, h: 109, l: 106, c: 108 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.stage).toBe("NO_C1");
    expect(r.detected).toBe(false);
  });

  it("C1_ONLY: bearish leg found, no C2 pullback yet — and includes a reason", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 105.5, l: 100, c: 101 },
      { o: 101, h: 102, l: 100.5, c: 101.5 },
      { o: 101.5, h: 102, l: 101, c: 101.8 },
      { o: 101.8, h: 102.5, l: 101.2, c: 102 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.stage).toBe("C1_ONLY");
    expect(r.reason).toBeTruthy();
    expect(r.protectedSwing).toBe(100);
  });

  it("C2_FORMING: wick below C1's low, not yet closed back above C1's close", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 105.5, l: 100, c: 101 },
      { o: 101, h: 102, l: 100.5, c: 101.5 },
      { o: 101.5, h: 102, l: 101, c: 101.8 },
      { o: 101.8, h: 102, l: 98, c: 99 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.stage).toBe("C2_FORMING");
    expect(r.reason).toBeTruthy();
  });

  it("C2_CONFIRMED: valid C2 failure swing, no C3 yet", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 105.5, l: 100, c: 101 },
      { o: 101, h: 101.5, l: 98, c: 101.2 },
      { o: 101.2, h: 102, l: 99, c: 101.5 },
      { o: 101.5, h: 102, l: 99.5, c: 101.8 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.stage).toBe("C2_CONFIRMED");
    expect(r.c2.l).toBe(98);
  });

  it("C3_FORMING: wick below C2's low, not yet CISD-confirmed", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 105.5, l: 100, c: 101 },
      { o: 101, h: 101.5, l: 98, c: 101.2 },
      { o: 101.2, h: 102, l: 99, c: 101.5 },
      { o: 101.5, h: 102, l: 97, c: 99 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.stage).toBe("C3_FORMING");
    expect(r.reason).toBeTruthy();
  });

  it("C3_CISD_CONFIRMED: full sequence, HIGH confidence", () => {
    const candles = [
      { o: 100, h: 110, l: 99, c: 105 },
      { o: 105, h: 105.5, l: 100, c: 101 },
      { o: 101, h: 101.5, l: 98, c: 101.2 },
      { o: 101.2, h: 102, l: 99, c: 101.5 },
      { o: 101.5, h: 103, l: 97, c: 102 },
      { o: 102, h: 104, l: 100, c: 103 },
    ];
    const r = detectC123(candles, "bull");
    expect(r.detected).toBe(true);
    expect(r.stage).toBe("C3_CISD_CONFIRMED");
    expect(r.direction).toBe("bull");
    expect(r.confidence).toBe("HIGH");
    expect(r.inOTE).toBe(true);
    expect(r.protectedSwingIntact).toBe(true);
  });
});

describe("detectC123 — bear direction (mirror of bull)", () => {
  it("NO_C1: no bullish leg from the swing low", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 95.5, l: 94, c: 94.5 },
      { o: 94.5, h: 95, l: 93.5, c: 94 },
      { o: 94, h: 94.5, l: 93, c: 93.5 },
      { o: 93.5, h: 94, l: 93, c: 93.2 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.stage).toBe("NO_C1");
  });

  it("C1_ONLY: bullish leg found, no C2 pullback yet — and includes a reason (regression test: this was previously missing entirely)", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 100, l: 94.5, c: 99 },
      { o: 99, h: 99.5, l: 98, c: 98.5 },
      { o: 98.5, h: 99, l: 98, c: 98.2 },
      { o: 98.2, h: 98.8, l: 97.5, c: 98 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.stage).toBe("C1_ONLY");
    expect(r.reason).toBeTruthy();
    expect(r.protectedSwing).toBe(100);
  });

  it("C2_FORMING: wick above C1's high, not yet closed back below C1's close — and includes a reason (regression test)", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 100, l: 94.5, c: 99 },
      { o: 99, h: 99.5, l: 98, c: 98.5 },
      { o: 98.5, h: 99, l: 98, c: 98.2 },
      { o: 98.2, h: 102, l: 97.5, c: 101 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.stage).toBe("C2_FORMING");
    expect(r.reason).toBeTruthy();
  });

  it("C2_CONFIRMED: valid C2 failure swing, no C3 yet", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 100, l: 94.5, c: 99 },
      { o: 99, h: 102, l: 98, c: 98.8 },
      { o: 98.8, h: 101, l: 98, c: 98.5 },
      { o: 98.5, h: 100.5, l: 97.5, c: 98.2 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.stage).toBe("C2_CONFIRMED");
    expect(r.c2.h).toBe(102);
  });

  it("C3_FORMING: wick above C2's high, not yet CISD-confirmed — and includes a reason (regression test)", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 100, l: 94.5, c: 99 },
      { o: 99, h: 102, l: 98, c: 98.8 },
      { o: 98.8, h: 101, l: 98, c: 98.5 },
      { o: 98.5, h: 103, l: 97, c: 101 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.stage).toBe("C3_FORMING");
    expect(r.reason).toBeTruthy();
  });

  it("C3_CISD_CONFIRMED: full sequence, HIGH confidence", () => {
    const candles = [
      { o: 100, h: 101, l: 90, c: 95 },
      { o: 95, h: 100, l: 94.5, c: 99 },
      { o: 99, h: 102, l: 98, c: 98.8 },
      { o: 98.8, h: 101, l: 98, c: 98.5 },
      { o: 98.5, h: 103, l: 97, c: 97.5 },
      { o: 97.5, h: 99, l: 96, c: 97 },
    ];
    const r = detectC123(candles, "bear");
    expect(r.detected).toBe(true);
    expect(r.stage).toBe("C3_CISD_CONFIRMED");
    expect(r.direction).toBe("bear");
    expect(r.confidence).toBe("HIGH");
    expect(r.inOTE).toBe(true);
    expect(r.protectedSwingIntact).toBe(true);
  });
});

describe("detectC123 — bull/bear shape parity (catches asymmetry regressions)", () => {
  // Every early-return branch should offer the same fields regardless of
  // direction — this is exactly the class of bug that shipped silently
  // (bear branches missing `reason`) until this test suite existed.
  const stages = ["C1_ONLY", "C2_FORMING", "C2_CONFIRMED", "C3_FORMING"];
  it.each(stages)("%s: bull and bear both include a reason field", (stage) => {
    const fixtures = {
      C1_ONLY: {
        bull: [
          { o: 100, h: 110, l: 99, c: 105 },
          { o: 105, h: 105.5, l: 100, c: 101 },
          { o: 101, h: 102, l: 100.5, c: 101.5 },
          { o: 101.5, h: 102, l: 101, c: 101.8 },
          { o: 101.8, h: 102.5, l: 101.2, c: 102 },
        ],
        bear: [
          { o: 100, h: 101, l: 90, c: 95 },
          { o: 95, h: 100, l: 94.5, c: 99 },
          { o: 99, h: 99.5, l: 98, c: 98.5 },
          { o: 98.5, h: 99, l: 98, c: 98.2 },
          { o: 98.2, h: 98.8, l: 97.5, c: 98 },
        ],
      },
      C2_FORMING: {
        bull: [
          { o: 100, h: 110, l: 99, c: 105 },
          { o: 105, h: 105.5, l: 100, c: 101 },
          { o: 101, h: 102, l: 100.5, c: 101.5 },
          { o: 101.5, h: 102, l: 101, c: 101.8 },
          { o: 101.8, h: 102, l: 98, c: 99 },
        ],
        bear: [
          { o: 100, h: 101, l: 90, c: 95 },
          { o: 95, h: 100, l: 94.5, c: 99 },
          { o: 99, h: 99.5, l: 98, c: 98.5 },
          { o: 98.5, h: 99, l: 98, c: 98.2 },
          { o: 98.2, h: 102, l: 97.5, c: 101 },
        ],
      },
      C2_CONFIRMED: {
        bull: [
          { o: 100, h: 110, l: 99, c: 105 },
          { o: 105, h: 105.5, l: 100, c: 101 },
          { o: 101, h: 101.5, l: 98, c: 101.2 },
          { o: 101.2, h: 102, l: 99, c: 101.5 },
          { o: 101.5, h: 102, l: 99.5, c: 101.8 },
        ],
        bear: [
          { o: 100, h: 101, l: 90, c: 95 },
          { o: 95, h: 100, l: 94.5, c: 99 },
          { o: 99, h: 102, l: 98, c: 98.8 },
          { o: 98.8, h: 101, l: 98, c: 98.5 },
          { o: 98.5, h: 100.5, l: 97.5, c: 98.2 },
        ],
      },
      C3_FORMING: {
        bull: [
          { o: 100, h: 110, l: 99, c: 105 },
          { o: 105, h: 105.5, l: 100, c: 101 },
          { o: 101, h: 101.5, l: 98, c: 101.2 },
          { o: 101.2, h: 102, l: 99, c: 101.5 },
          { o: 101.5, h: 102, l: 97, c: 99 },
        ],
        bear: [
          { o: 100, h: 101, l: 90, c: 95 },
          { o: 95, h: 100, l: 94.5, c: 99 },
          { o: 99, h: 102, l: 98, c: 98.8 },
          { o: 98.8, h: 101, l: 98, c: 98.5 },
          { o: 98.5, h: 103, l: 97, c: 101 },
        ],
      },
    };
    const bullR = detectC123(fixtures[stage].bull, "bull");
    const bearR = detectC123(fixtures[stage].bear, "bear");
    expect(bullR.stage).toBe(stage);
    expect(bearR.stage).toBe(stage);
    expect(bullR.reason).toBeTruthy();
    expect(bearR.reason).toBeTruthy();
  });
});
