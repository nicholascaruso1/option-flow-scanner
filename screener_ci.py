#!/usr/bin/env python3
"""
Option Flow — CI Screener (GitHub Actions version)
====================================================
Same 5 pre-condition checks as screener.py, but outputs JSON to
data/stocks.json so the scanner frontend can fetch it on load.

Runs automatically via GitHub Actions on a schedule.
Do NOT run this manually — use screener.py for local runs.
"""

import json
import os
import sys
import warnings
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

try:
    import pandas as pd
    import yfinance as yf
except ImportError:
    sys.exit("Missing deps — pip install yfinance pandas")

# ── Universe (same as screener.py) ──────────────────────────────────────────
DEFAULT_UNIVERSE = [
    "NVDA","AMD","AAPL","MSFT","GOOGL","AMZN","META","TSLA","AVGO","ORCL",
    "CRM","ADBE","NFLX","INTC","MU","QCOM","SMCI","PLTR","SNOW","CRWD",
    "TSM","ASML","AMAT","LRCX","KLAC","MRVL","ARM","ON","MPWR","TER",
    "JPM","GS","MS","BAC","WFC","C","SCHW","COIN","HOOD","SOFI",
    "LLY","UNH","JNJ","PFE","MRNA","ABCL","ATAI","MLYS","CRSP","BEAM",
    "NTLA","VRTX","REGN","AMGN","GILD","BMY","IONQ","RXRX","TEM","HIMS",
    "XOM","CVX","OXY","SLB","HAL","DVN","FANG","MPC","VLO","COP",
    "BA","LMT","RTX","NOC","GD","GE","CAT","DE","HON","ETN",
    "WMT","COST","TGT","HD","LOW","NKE","SBUX","MCD","CMG","LULU",
    "ILLR","SPCX","RKLB","ASTS","LUNR","RDW","ACHR","JOBY","OKLO","SMR",
    "CLSK","MARA","RIOT","MSTR","APLD","IREN","WULF","CIFR","BTBT","HUT",
    "SPY","QQQ","IWM","DIA","GLD","SLV","USO","XLE","XLF","XBI",
]

def get_sp500_tickers():
    try:
        tables = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
        syms = tables[0]["Symbol"].tolist()
        return [s.replace(".", "-") for s in syms]
    except Exception as e:
        print(f"  ! S&P 500 fetch failed ({e}), falling back to default universe")
        return DEFAULT_UNIVERSE

def analyze(df):
    if df is None or len(df) < 210:
        return None
    close = df["Close"]
    high, low, vol = df["High"], df["Low"], df["Volume"]
    price = float(close.iloc[-1])

    sma20  = float(close.rolling(20).mean().iloc[-1])
    sma50  = float(close.rolling(50).mean().iloc[-1])
    sma200 = float(close.rolling(200).mean().iloc[-1])
    above  = sum([price > sma20, price > sma50, price > sma200])
    bias   = "BULL" if above == 3 else "BEAR" if above == 0 else "MIXED"
    c1_bias = bias in ("BULL", "BEAR")

    tr  = pd.concat([high - low,
                     (high - close.shift()).abs(),
                     (low  - close.shift()).abs()], axis=1).max(axis=1)
    atr = tr.rolling(14).mean()

    last10   = df.iloc[-10:]
    atr10    = atr.iloc[-10:]
    ranges   = last10["High"] - last10["Low"]
    exp_mask = ranges > 1.5 * atr10
    c2_expansion = bool(exp_mask.any())

    exp_day = None
    c3_retrace = False
    c4_volume  = False
    retr_pct   = None
    exp_dir    = None

    if c2_expansion:
        exp_day   = ranges[exp_mask].index[-1]
        exp_high  = float(df.loc[exp_day, "High"])
        exp_low   = float(df.loc[exp_day, "Low"])
        exp_up    = float(df.loc[exp_day, "Close"]) > float(df.loc[exp_day, "Open"])
        exp_dir   = "BULL" if exp_up else "BEAR"
        rng       = exp_high - exp_low
        if rng > 0:
            retr_pct   = (exp_high - price) / rng if exp_up else (price - exp_low) / rng
            c3_retrace = 0.0 <= retr_pct <= 0.50
        v20       = float(vol.rolling(20).mean().loc[exp_day])
        c4_volume = v20 > 0 and float(vol.loc[exp_day]) > 1.5 * v20

    avg_vol  = float(vol.rolling(20).mean().iloc[-1])
    c5_liquid = price >= 2.0 and avg_vol >= 500_000
    met       = sum([c1_bias, c2_expansion, c3_retrace, c4_volume, c5_liquid])

    # Suggested direction: bias drives it, but expansion direction is tie-breaker
    direction = bias if bias in ("BULL", "BEAR") else exp_dir or "MIXED"

    # AM Trades: detect swings + compute draw-on-liquidity projection
    sw_high, sw_low = detect_swings(df)
    projection      = am_projection(price, direction, sw_high, sw_low)

    return {
        "ticker":     None,          # filled in below
        "price":      round(price, 2),
        "bias":       bias,
        "direction":  direction,     # BULL → call candidate, BEAR → put candidate
        "met":        met,
        "conditions": {
            "topdown_bias": c1_bias,
            "expansion":    c2_expansion,
            "in_zone":      c3_retrace,
            "vol_confirm":  c4_volume,
            "liquid":       c5_liquid,
        },
        "details": {
            "sma20":    round(sma20, 2),
            "sma50":    round(sma50, 2),
            "sma200":   round(sma200, 2),
            "avg_vol_m": round(avg_vol / 1e6, 2),
            "retr_pct": round(retr_pct * 100, 1) if retr_pct is not None else None,
            "exp_date": exp_day.strftime("%Y-%m-%d") if exp_day is not None else None,
            "exp_dir":  exp_dir,
        },
        "am_projection": projection,
    }


# ── AM Trades Framework: Swing Detection + Projection ───────────────────────

def detect_swings(df, lookback=10):
    highs = df["High"].values
    lows  = df["Low"].values
    dates = df.index
    n = len(df)
    swing_high = None
    swing_low  = None
    for i in range(n - lookback - 1, lookback - 1, -1):
        if swing_high is None:
            window_h = highs[i - lookback : i + lookback + 1]
            if highs[i] == max(window_h):
                swing_high = {"price": round(float(highs[i]), 2), "date": dates[i].strftime("%Y-%m-%d"), "bars_ago": n - 1 - i}
        if swing_low is None:
            window_l = lows[i - lookback : i + lookback + 1]
            if lows[i] == min(window_l):
                swing_low = {"price": round(float(lows[i]), 2), "date": dates[i].strftime("%Y-%m-%d"), "bars_ago": n - 1 - i}
        if swing_high and swing_low:
            break
    return swing_high, swing_low


def profile_guess():
    from datetime import datetime, timedelta
    tomorrow = datetime.now() + timedelta(days=1)
    while tomorrow.weekday() >= 5:
        tomorrow += timedelta(days=1)
    wd = tomorrow.weekday()
    profiles = {
        0: ("Monday Rule — Avoid", "No trades Monday per AM protocol. Observe structure and plan."),
        1: ("Classic Expansion", "Tuesday trend day. Price typically expands in primary direction from weekly open."),
        2: ("Midweek Reversal Watch", "Wednesday pivot watch. If Mon-Tue trended, reversal risk increases at prior highs/lows."),
        3: ("Continuation or Counter", "Thursday: continuation of expansion OR early setup for Friday TGIF."),
        4: ("TGIF Setup", "Friday: fade the week move. Watch for reversal into close at prior swing."),
    }
    label, note = profiles.get(wd, ("Unknown", ""))
    return {"label": label, "note": note, "next_day": tomorrow.strftime("%A %b %d")}


def am_projection(price, direction, swing_high, swing_low):
    reaction = None; target = None; draw_pct = None; gate_reaction = False
    if direction == "BULL" and swing_low and swing_high:
        reaction = {"type": "low",  **swing_low}
        target   = {"type": "high", **swing_high}
        draw_pct = round((swing_high["price"] - price) / price * 100, 1) if price > 0 else None
        gate_reaction = True
    elif direction == "BEAR" and swing_high and swing_low:
        reaction = {"type": "high", **swing_high}
        target   = {"type": "low",  **swing_low}
        draw_pct = round((price - swing_low["price"]) / price * 100, 1) if price > 0 else None
        gate_reaction = True
    prof = profile_guess()
    gate_profile = prof["label"] != "Monday Rule — Avoid"
    return {"reaction_swing": reaction, "draw_target": target, "draw_pct": draw_pct,
            "profile": prof, "gate_reaction": gate_reaction, "gate_profile": gate_profile,
            "both_gates": gate_reaction and gate_profile}

def main():
    # Config from env vars (set in GitHub Actions workflow)
    use_sp500 = os.environ.get("SCREENER_SP500", "false").lower() == "true"
    min_met   = int(os.environ.get("SCREENER_MIN_MET", "4"))
    out_path  = os.environ.get("SCREENER_OUT", "data/stocks.json")

    universe = get_sp500_tickers() if use_sp500 else DEFAULT_UNIVERSE
    print(f"Screening {len(universe)} tickers (min-met={min_met})...")

    data = yf.download(
        universe, period="1y", interval="1d",
        group_by="ticker", auto_adjust=True,
        progress=False, threads=True,    # no progress bar in CI
    )

    rows = []
    for t in universe:
        try:
            df = data[t].dropna() if len(universe) > 1 else data.dropna()
            r  = analyze(df)
            if r and r["met"] >= min_met:
                r["ticker"] = t
                rows.append(r)
        except Exception as e:
            print(f"  skip {t}: {e}")
            continue

    rows.sort(key=lambda r: (-r["met"], -r["details"]["avg_vol_m"]))

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "universe_size": len(universe),
        "min_met": min_met,
        "candidates": rows,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(rows)} candidates to {out_path}")

if __name__ == "__main__":
    main()
