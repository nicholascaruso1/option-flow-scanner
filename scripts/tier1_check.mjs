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
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), "tier1_state.json");

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

export function rank(stage) {
  return STAGE_RANK[stage] ?? -1;
}

const CONFIDENCE_DOWNGRADE = { HIGH: "MEDIUM", MEDIUM: "LOW", LOW: "LOW" };
export function downgradeConfidence(confidence) {
  if (!confidence) return confidence;
  return CONFIDENCE_DOWNGRADE[confidence] || confidence;
}

// Even with zero structural change, a symbol's narrative can go stale —
// price context, catalysts, and phase notes drift from reality the longer
// a card sits untouched. This forces a refresh floor independent of the
// stage/invalidation/confidence triggers below.
const STALE_ANALYSIS_DAYS = 14;
export function daysSinceAnalysis(dataAsOf) {
  if (!dataAsOf) return Infinity; // no dataAsOf at all = treat as maximally stale
  const parsed = Date.parse(dataAsOf);
  if (Number.isNaN(parsed)) return Infinity;
  return Math.floor((Date.now() - parsed) / 86400000);
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
  const r = await fetch(`${WORKER}/user-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`POST /user-data failed: ${r.status} — ${body}`);
  }
}

async function fetchCandles(symbol) {
  const r = await fetch(`${WORKER}/candles?symbol=${symbol}&resolution=daily&bars=30`);
  const json = await r.json();
  if (!json.ok) throw new Error(`candles fetch failed for ${symbol}: ${json.error || "unknown"}`);
  return json.candles;
}

async function fetchWeeklyCandles(symbol) {
  const r = await fetch(`${WORKER}/candles?symbol=${symbol}&resolution=weekly&bars=12`);
  const json = await r.json();
  if (!json.ok) throw new Error(`weekly candles fetch failed for ${symbol}: ${json.error || "unknown"}`);
  return json.candles;
}

// Simple higher-timeframe bias read: compares the latest weekly close against
// the close ~8 weeks back. Not meant to be sophisticated — just a top-down
// sanity check per the framework's "monthly/weekly/daily alignment" rule.
// A daily C2/C3 confirming against opposing weekly structure is weaker evidence
// than one confirming with the weekly trend, especially when the daily move
// was gap-driven mid-week (which weekly candles absorb and smooth out).
export function computeWeeklyBias(weeklyCandles) {
  if (!weeklyCandles || weeklyCandles.length < 8) return null;
  const recent = weeklyCandles[weeklyCandles.length - 1];
  const lookback = weeklyCandles[weeklyCandles.length - 8];
  const pctChange = (recent.c - lookback.c) / lookback.c;
  if (pctChange > 0.02) return "bull";
  if (pctChange < -0.02) return "bear";
  return "neutral";
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

export function meaningfulChange(prev, next) {
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

  const prevWeeklyConflict = prev.weeklyConflict === true;
  const nextWeeklyConflict = next.weeklyConflict === true;
  if (prevWeeklyConflict !== nextWeeklyConflict) {
    return {
      changed: true,
      reason: nextWeeklyConflict
        ? "weekly bias now conflicts with daily setup direction"
        : "weekly bias conflict resolved",
    };
  }

  return { changed: false, reason: "no meaningful change" };
}

async function main() {
  console.log("Tier 1: fetching current KV state...");
  const kv = await getUserData();
  const aiCards = kv.of_ai_cards || {};
  let tier1State = {};
  try {
    tier1State = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    tier1State = {};
  }

  const symbols = Object.keys(aiCards);
  console.log(`Tier 1: ${symbols.length} tracked symbol(s): ${symbols.join(", ") || "(none)"}`);

  if (symbols.length === 0) {
    console.log("Tier 1: nothing to check, exiting.");
    return;
  }

  const nextState = { ...tier1State };
  // Detection state for symbols that triggered Tier 2 is held here, NOT written
  // into nextState yet — it's only safe to persist once the corresponding card
  // content has actually landed in KV. Committing it earlier (the previous
  // behavior) meant a failed KV write could leave tier1_state.json claiming a
  // stage the live card never actually reflects, and since meaningfulChange()
  // only fires on a further stage change, that symbol would then be stuck
  // showing stale content forever with no self-healing retrigger.
  const pendingNextState = {};
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

      // Higher-timeframe (weekly) bias check — only worth checking once a real
      // daily setup exists (C1_ONLY or beyond). Weekly candles are KV-cached
      // 24h on the Worker side, so this is a cache hit most nights.
      let weeklyBias = null, weeklyConflict = false;
      let effectiveConfidence = result.confidence || null;
      if (rank(result.stage) >= 1) {
        try {
          await sleep(CANDLE_FETCH_DELAY_MS);
          const weeklyCandles = await fetchWeeklyCandles(symbol);
          weeklyBias = computeWeeklyBias(weeklyCandles);
          // direction is "bull"/"bear"; weeklyBias is "bull"/"bear"/"neutral"
          if ((direction === "bull" && weeklyBias === "bear") || (direction === "bear" && weeklyBias === "bull")) {
            weeklyConflict = true;
            effectiveConfidence = downgradeConfidence(effectiveConfidence);
          }
        } catch (e) {
          // Weekly bias is a confluence check, not a hard dependency — never fail
          // the whole symbol check just because the weekly fetch had an issue.
          console.error(`  ${symbol}: weekly bias check skipped — ${e.message}`);
        }
      }

      const next = {
        stage: result.stage,
        confidence: effectiveConfidence,
        weeklyBias,
        weeklyConflict,
        invalidated: invCheck.breached,
        invalidatedThreshold: invCheck.breached ? invCheck.threshold : null,
        price: lastClose,
        checkedAt: new Date().toISOString(),
      };

      const prev = tier1State[symbol];
      const structural = meaningfulChange(prev, next);
      const staleDays = daysSinceAnalysis(card.dataAsOf);
      const isStale = staleDays >= STALE_ANALYSIS_DAYS;
      const changed = structural.changed || isStale;
      const reason = structural.changed
        ? structural.reason
        : (isStale ? `stale — analysis is ${staleDays}d old (≥${STALE_ANALYSIS_DAYS}d threshold)` : structural.reason);

      console.log(`  ${symbol}: ${prev ? prev.stage : "(new)"} → ${next.stage} — ${changed ? "TRIGGER TIER 2" : "no change"} (${reason})`);

      if (changed) {
        const analysis = await triggerTier2(symbol, card, lastClose ?? card.price);
        if (analysis) {
          const updatedCard = {
            ...card,
            ...analysis,
            tier: "Tier 2", isActive: false, aiGenerated: true,
            dataAsOf: new Date().toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"}),
            price: lastClose ?? card.price,
            chg: 0, vol: "—",
            cap: analysis.capSize || card.cap || "Mid",
            capSize: analysis.capSize || card.capSize || "Mid",
            accountFit: analysis.accountFit || card.accountFit || [],
            earningsDate: analysis.earningsDate && analysis.earningsDate !== "null" ? analysis.earningsDate : null,
            earningsLabel: analysis.earningsLabel && analysis.earningsLabel !== "null" ? analysis.earningsLabel : null,
            analysisHistory: [...(card.analysisHistory || []), ...(card.logEntry ? [{ts: card.dataAsOf || "prior", note: card.logEntry.note}] : [])].slice(-5),
          };
          aiCards[symbol] = updatedCard;
          console.log(`  ${symbol}: Tier 2 card saved (dataAsOf: ${updatedCard.dataAsOf})`);
        }
        tier2Fired.push({ symbol, reason });
        // Held back until the KV write below actually succeeds.
        pendingNextState[symbol] = next;
      } else {
        // No KV dependency for an unchanged symbol — safe to persist immediately.
        nextState[symbol] = next;
      }
    } catch (e) {
      console.error(`  ${symbol}: ERROR — ${e.message}`);
      errors.push({ symbol, error: e.message });
    }
  }

  let kvWriteFailed = false;
  if (tier2Fired.length > 0) {
    console.log("Tier 1: saving updated AI cards to KV...");
    try {
      // Re-fetch immediately before writing rather than reusing the snapshot
      // from the top of this run (which can now be several minutes stale after
      // the sequential candle/weekly/Tier-2 fetches above) — shrinks the window
      // in which this write can clobber a concurrent browser-side KV sync.
      const freshKv = await getUserData();
      await postUserData({ ...freshKv, of_ai_cards: { ...(freshKv.of_ai_cards || {}), ...aiCards } });
      console.log("Tier 1: KV save complete.");
      Object.assign(nextState, pendingNextState);
    } catch (e) {
      kvWriteFailed = true;
      console.error(`Tier 1: KV save FAILED — ${e.message}`);
      console.error(`Tier 1: NOT persisting detection state for ${Object.keys(pendingNextState).join(", ")} — will re-check fresh next run instead of getting stuck on stale content.`);
    }
  }

  console.log("Tier 1: persisting updated state to file...");
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2));

  console.log(`\nTier 1 summary: ${symbols.length} checked, ${tier2Fired.length} Tier 2 trigger(s), ${errors.length} error(s)`);
  if (tier2Fired.length) console.log("Tier 2 fired for:", tier2Fired.map((t) => `${t.symbol} (${t.reason})`).join("; "));
  if (errors.length) console.log("Errors:", errors.map((e) => `${e.symbol}: ${e.error}`).join("; "));

  if (kvWriteFailed || (errors.length === symbols.length && symbols.length > 0)) {
    process.exitCode = 1; // surface a failed KV save, or a run where every symbol errored
  }
}

// Only auto-run when this file is executed directly (`node tier1_check.mjs`),
// not when imported — e.g. by tier1_check.test.mjs, which imports the pure
// functions above without wanting to trigger a live nightly run.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Tier 1: fatal error:", e);
    process.exitCode = 1;
  });
}
