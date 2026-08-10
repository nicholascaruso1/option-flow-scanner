export function detectC123(candles, direction = "bull") {
  if (!candles || candles.length < 5)
    return { detected: false, stage: "INSUFFICIENT_DATA", reason: "Need at least 5 candles" };
  const n = candles.length;
  const isBearish = (c) => c.c < c.o;
  const isBullish = (c) => c.c > c.o;
  if (direction === "bull") {
    let swingHighIdx = 0;
    for (let i = 1; i < n; i++) if (candles[i].h > candles[swingHighIdx].h) swingHighIdx = i;
    let bearishLegEnd = -1, foundBearish = false;
    for (let i = swingHighIdx; i < n; i++) {
      if (isBearish(candles[i])) {
        bearishLegEnd = i;
        foundBearish = true;
      } else if (foundBearish) break;
    }
    if (bearishLegEnd === -1) return { detected: false, stage: "NO_C1", reason: "No bearish leg from swing high", swingHigh: candles[swingHighIdx].h };
    const bearishLegOriginOpen = candles[swingHighIdx].o;
    const c1Idx = bearishLegEnd, c1 = candles[c1Idx];
    let c2Idx = -1;
    for (let i = c1Idx + 1; i < n; i++) {
      const c = candles[i];
      if (c.l < c1.l && c.c > c1.c) {
        c2Idx = i;
        break;
      }
    }
    if (c2Idx === -1) {
      const last = candles[n - 1];
      return {
        detected: false,
        stage: last.l < c1.l ? "C2_FORMING" : "C1_ONLY",
        reason: last.l < c1.l ? `C2 wick below $${c1.l.toFixed(2)} — waiting for body close back above $${c1.c.toFixed(2)}` : `C1 confirmed. Waiting for C2 below $${c1.l.toFixed(2)}.`,
        c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
        protectedSwing: c1.l,
        swingHigh: candles[swingHighIdx].h
      };
    }
    const c2 = candles[c2Idx];
    const ob = { open: c1.o, close: c1.c, mean: (c1.o + c1.c) / 2, high: c1.h, low: c1.l };
    const swingHigh = candles[swingHighIdx].h, swingLow = c2.l;
    const oteZone = { low: swingLow, high: swingLow + 0.5 * (swingHigh - swingLow) };
    let c3Idx = -1;
    for (let i = c2Idx + 1; i < n; i++) {
      const c = candles[i];
      if (c.l < c2.l && c.c > bearishLegOriginOpen) {
        c3Idx = i;
        break;
      }
    }
    if (c3Idx === -1) {
      const last = candles[n - 1];
      return {
        detected: false,
        stage: last.l < c2.l ? "C3_FORMING" : "C2_CONFIRMED",
        reason: last.l < c2.l ? `C3 wick below $${c2.l.toFixed(2)} — waiting for CISD body close above $${bearishLegOriginOpen.toFixed(2)}` : `C2 at $${c2.l.toFixed(2)}. Waiting for C3.`,
        c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
        c2: { idx: c2Idx, o: c2.o, h: c2.h, l: c2.l, c: c2.c },
        ob,
        oteZone,
        swingHigh,
        swingLow,
        bearishLegOriginOpen,
        protectedSwing: c2.l
      };
    }
    const c3 = candles[c3Idx];
    const inOTE = c3.c >= oteZone.low && c3.c <= oteZone.high;
    let protectedSwingIntact = true;
    for (let i = c3Idx + 1; i < n; i++) if (candles[i].c < c2.l) {
      protectedSwingIntact = false;
      break;
    }
    const lastClose = candles[n - 1].c, atOBMean = lastClose >= ob.mean;
    const confidence = inOTE && protectedSwingIntact && atOBMean ? "HIGH" : protectedSwingIntact && (inOTE || atOBMean) ? "MEDIUM" : "LOW";
    return {
      detected: true,
      stage: "C3_CISD_CONFIRMED",
      direction: "bull",
      c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
      c2: { idx: c2Idx, o: c2.o, h: c2.h, l: c2.l, c: c2.c },
      c3: { idx: c3Idx, o: c3.o, h: c3.h, l: c3.l, c: c3.c },
      cisd: true,
      swingHigh,
      swingLow,
      bearishLegOriginOpen,
      ob,
      oteZone,
      inOTE,
      atOBMean,
      protectedSwingIntact,
      protectedSwing: c2.l,
      confidence,
      summary: `C3 CISD confirmed. OB mean $${ob.mean.toFixed(2)}. OTE $${oteZone.low.toFixed(2)}–$${oteZone.high.toFixed(2)}. Protected swing $${c2.l.toFixed(2)}.`
    };
  }
  if (direction === "bear") {
    let swingLowIdx = 0;
    for (let i = 1; i < n; i++) if (candles[i].l < candles[swingLowIdx].l) swingLowIdx = i;
    let bullishLegEnd = -1, foundBullish = false;
    for (let i = swingLowIdx; i < n; i++) {
      if (isBullish(candles[i])) {
        bullishLegEnd = i;
        foundBullish = true;
      } else if (foundBullish) break;
    }
    if (bullishLegEnd === -1) return { detected: false, stage: "NO_C1", reason: "No bullish leg from swing low", swingLow: candles[swingLowIdx].l };
    const bullishLegOriginOpen = candles[swingLowIdx].o;
    const c1Idx = bullishLegEnd, c1 = candles[c1Idx];
    let c2Idx = -1;
    for (let i = c1Idx + 1; i < n; i++) {
      const c = candles[i];
      if (c.h > c1.h && c.c < c1.c) {
        c2Idx = i;
        break;
      }
    }
    if (c2Idx === -1) {
      const last = candles[n - 1];
      return {
        detected: false,
        stage: last.h > c1.h ? "C2_FORMING" : "C1_ONLY",
        c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
        protectedSwing: c1.h,
        swingLow: candles[swingLowIdx].l
      };
    }
    const c2 = candles[c2Idx];
    const ob = { open: c1.o, close: c1.c, mean: (c1.o + c1.c) / 2, high: c1.h, low: c1.l };
    const swingLow = candles[swingLowIdx].l, swingHigh = c2.h;
    const oteZone = { low: swingHigh - 0.5 * (swingHigh - swingLow), high: swingHigh };
    let c3Idx = -1;
    for (let i = c2Idx + 1; i < n; i++) {
      const c = candles[i];
      if (c.h > c2.h && c.c < bullishLegOriginOpen) {
        c3Idx = i;
        break;
      }
    }
    if (c3Idx === -1) {
      const last = candles[n - 1];
      return {
        detected: false,
        stage: last.h > c2.h ? "C3_FORMING" : "C2_CONFIRMED",
        c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
        c2: { idx: c2Idx, o: c2.o, h: c2.h, l: c2.l, c: c2.c },
        ob,
        oteZone,
        swingHigh,
        swingLow,
        bullishLegOriginOpen,
        protectedSwing: c2.h
      };
    }
    const c3 = candles[c3Idx];
    const inOTE = c3.c >= oteZone.low && c3.c <= oteZone.high;
    let protectedSwingIntact = true;
    for (let i = c3Idx + 1; i < n; i++) if (candles[i].c > c2.h) {
      protectedSwingIntact = false;
      break;
    }
    const lastClose = candles[n - 1].c, atOBMean = lastClose <= ob.mean;
    const confidence = inOTE && protectedSwingIntact && atOBMean ? "HIGH" : protectedSwingIntact && (inOTE || atOBMean) ? "MEDIUM" : "LOW";
    return {
      detected: true,
      stage: "C3_CISD_CONFIRMED",
      direction: "bear",
      c1: { idx: c1Idx, o: c1.o, h: c1.h, l: c1.l, c: c1.c },
      c2: { idx: c2Idx, o: c2.o, h: c2.h, l: c2.l, c: c2.c },
      c3: { idx: c3Idx, o: c3.o, h: c3.h, l: c3.l, c: c3.c },
      cisd: true,
      swingHigh,
      swingLow,
      bullishLegOriginOpen,
      ob,
      oteZone,
      inOTE,
      atOBMean,
      protectedSwingIntact,
      protectedSwing: c2.h,
      confidence,
      summary: `C3 CISD confirmed. OB mean $${ob.mean.toFixed(2)}. OTE $${oteZone.low.toFixed(2)}–$${oteZone.high.toFixed(2)}. Protected swing $${c2.h.toFixed(2)}.`
    };
  }
  return { detected: false, stage: "UNKNOWN_DIRECTION" };
}
