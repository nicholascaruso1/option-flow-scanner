// scripts/tier1_check.mjs
// Runs nightly (same workflow as screener_ci.py, as its own separate step).
// For every symbol currently tracked in of_ai_cards:
//   1. Fetch fresh daily candles from the Worker (throttled to stay under Polygon's free-tier rate limit)
//   2. Run detectC123 (same pure function the browser uses)
//   3. Run checkInvalidation against the card's live price (same logic + string parsing the browser's ⚠ badge uses)
//   4. Compare new stage/confidence/invalidation against last known state (of_tier1_state in KV)
//   5. If a MEANINGFUL change occurred, call the Worker's /analyze endpoint to trigger Tier 2 (Claude)
//   6. Persist updated state back to KV
//
// "Meaningful change" — NOT triggered by price movement alone:
//   - stage advanced (via STAGE_RANK ordinal)
//   - invalidation flipped false → true
//   - confidence changed (LOW/MEDIUM/HIGH)
//   - direction/phase flipped backward (stage rank decreased)

import { detectC123 } from "../src/lib/detectC123.js";
import { checkInvalidation } from "../src/lib/invalidation.js";

const WORKER = "https://market.electronmailbag.workers.dev";

// Polygon free tier is ~5 req/min. 13s between candle fetches keeps us safely under that
// even accounting for jitter/retries. With ~19 symbols this adds ~4min to the nightly run —
// trivial cost for a background job.
const CANDLE_FETCH_DELAY_MS = 13000;

const STAGE_RANK = {
  INSUFFICIENT_DATA: -1,
  NO_C1: -1,
  UNKNOWN_DIRECTION: -1,
  C1_ONLY: 1,
  C2_FORMING: 2,
  C2_CONFIRMED: 3,
  C3_FORMING: 4,
  C3_CISD_CONFIRMED: 5,
};

function rank(stage) {
  return STAGE_RANK[stage] ?? -1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserData() {
  const r = await fetch(`${WORKER}/user-data`);
  if (!r.ok) throw new Error(`GET /user-data failed: ${r.status}`);
  return r.json();
}

async function postUserData(payload) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`${WORKER}/user-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) return;
    const body = await r.text();
    console.error(`Tier 1: POST /user-data attempt ${attempt} failed: ${r.status} — ${body}`);
    if (attempt < 3) await new Promise(res => setTimeout(res, 5000));
  }
  throw new Error(`POST /user-data failed after 3 attempts`);
}

async function fetchCandles(symbol) {
  const r = await fetch(`${WORKER}/candles?symbol=${symbol}&resolution=daily&bars=30`);
  const json = await r.json();
  if (!json.ok) throw new Error(`candles fetch failed for ${symbol}: ${json.error || "unknown"}`);
  return json.candles;
}

async function triggerTier2(symbol, card, price) {
  const bias = (card.direction || card.dir) === "put" ? "BEAR" : "BULL";
  const prevHistory = card.analysisHistory || [];
  const prevLog = card.logEntry ? [{ ts: card.dataAsOf || "prior", note: card.logEntry.note }] : [];
  const histCtx = [...prevHistory, ...prevLog].slice(-3);

  const r = await fetch(`${WORKER}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: symbol,
      price,
      bias,
      retracement: null,
      conditions: {},
      details: {},
      historyContext: histCtx.length ? histCtx : undefined,
    }),
  });
  const json = await r.json();
  if (!json.ok) throw new Error(`analyze failed for ${symbol}: ${json.error || "unknown"}`);
  return json.analysis;
}

function meaningfulChange(prev, next) {
  if (!prev) return { changed: true, reason: "no prior state (first check)" };

  const prevRank = rank(prev.stage);
  const nextRank = rank(next.stage);

  if (nextRank > prevRank) return { changed: true, reason: `stage advanced ${prev.stage} → ${next.stage}` };
  if (nextRank < prevRank) return { changed: true, reason: `stage flipped backward ${prev.stage} → ${next.stage}` };

  const prevInvalid = prev.invalidated === true;
  const nextInvalid = next.invalidated === true;
  if (!prevInvalid && nextInvalid) return { changed: true, reason: "invalidation flipped false → true" };

  if (prev.confidence && next.confidence && prev.confidence !== next.confidence) {
    return { changed: true, reason: `confidence changed ${prev.confidence} → ${next.confidence}` };
  }

  return { changed: false, reason: "no meaningful change" };
}

async function main() {
  console.log("Tier 1: fetching current KV state...");
  const kv = await getUserData();
  const aiCards = kv.of_ai_cards || {};
  const tier1State = kv.of_tier1_state || {};

  const symbols = Object.keys(aiCards);
  console.log(`Tier 1: ${symbols.length} tracked symbol(s): ${symbols.join(", ") || "(none)"}`);

  if (symbols.length === 0) {
    console.log("Tier 1: nothing to check, exiting.");
    return;
  }

  const nextState = { ...tier1State };
  const tier2Fired = [];
  const errors = [];

  for (let idx = 0; idx < symbols.length; idx++) {
    const symbol = symbols[idx];
    const card = aiCards[symbol];
    const direction = (card.direction || card.dir) === "put" ? "bear" : "bull";

    if (idx > 0) {
      await sleep(CANDLE_FETCH_DELAY_MS);
    }

    try {
      const candles = await fetchCandles(symbol);
      const result = detectC123(candles, direction);

      const lastClose = candles?.[candles.length - 1]?.c ?? null;

      // Same invalidation logic the browser's ⚠ INVALIDATED badge uses —
      // parses the card's free-text invalidation string against live price.
      const invCheck = checkInvalidation(card, lastClose);

      const next = {
        stage: result.stage,
        confidence: result.confidence || null,
        invalidated: invCheck.breached,
        invalidatedThreshold: invCheck.breached ? invCheck.threshold : null,
        price: lastClose,
        checkedAt: new Date().toISOString(),
      };

      const prev = tier1State[symbol];
      const { changed, reason } = meaningfulChange(prev, next);

      console.log(`  ${symbol}: ${prev ? prev.stage : "(new)"} → ${next.stage} — ${changed ? "TRIGGER TIER 2" : "no change"} (${reason})`);

      if (changed) {
        await triggerTier2(symbol, card, lastClose ?? card.price);
        tier2Fired.push({ symbol, reason });
      }

      nextState[symbol] = next;
    } catch (e) {
      console.error(`  ${symbol}: ERROR — ${e.message}`);
      errors.push({ symbol, error: e.message });
    }
  }

  console.log("Tier 1: persisting updated state to KV...");
  await postUserData({ ...kv, of_tier1_state: nextState });

  console.log(`\nTier 1 summary: ${symbols.length} checked, ${tier2Fired.length} Tier 2 trigger(s), ${errors.length} error(s)`);
  if (tier2Fired.length) console.log("Tier 2 fired for:", tier2Fired.map((t) => `${t.symbol} (${t.reason})`).join("; "));
  if (errors.length) console.log("Errors:", errors.map((e) => `${e.symbol}: ${e.error}`).join("; "));

  if (errors.length === symbols.length && symbols.length > 0) {
    process.exitCode = 1; // hard fail only if every symbol errored
  }
}

main().catch((e) => {
  console.error("Tier 1: fatal error:", e);
  process.exitCode = 1;
});
