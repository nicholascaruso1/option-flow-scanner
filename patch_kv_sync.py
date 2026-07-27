#!/usr/bin/env python3
"""
patch_kv_sync.py
Adds Cloudflare KV cross-device sync to Option Flow Scanner.
  1. On app load: fetches data from KV and overrides localStorage
  2. On any state change: debounced POST to KV after 2s

Run: python3 patch_kv_sync.py
"""

import sys, os

PATH = os.path.expanduser("~/option-flow-scanner/src/App.jsx")

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

print(f"Loaded {len(src.splitlines())} lines from {PATH}")
errors = []

# ─────────────────────────────────────────────────────────────────
# PATCH 1 — Replace setInitDone(true) line to insert KV load first
# ─────────────────────────────────────────────────────────────────

OLD1 = 'setAiCards(ac||{}); setInitDone(true);'

NEW1 = '''setAiCards(ac||{});
try {
  const kvR = await fetch("https://market.electronmailbag.workers.dev/user-data");
  if(kvR.ok){
    const kv=await kvR.json();
    if(kv.of_favs?.length){setFavs(kv.of_favs);ss("of_favs",kv.of_favs);}
    if(kv.of_checks&&Object.keys(kv.of_checks).length){setChecks(kv.of_checks);ss("of_checks",kv.of_checks);}
    if(kv.of_ai_updates&&Object.keys(kv.of_ai_updates).length){setAiUpdates(kv.of_ai_updates);ss("of_ai_updates",kv.of_ai_updates);}
    if(kv.of_ai_cards&&Object.keys(kv.of_ai_cards).length){setAiCards(kv.of_ai_cards);ss("of_ai_cards",kv.of_ai_cards);}
    if(kv.of_c123&&Object.keys(kv.of_c123).length){setC123(kv.of_c123);ss("of_c123",kv.of_c123);}
    if(kv.of_journal&&Object.keys(kv.of_journal).length){setJournalNotes(kv.of_journal);ss("of_journal",kv.of_journal);}
    if(kv.of_preflight&&Object.keys(kv.of_preflight).length){setPfChecks(kv.of_preflight);ss("of_preflight",kv.of_preflight);}
    if(kv.of_closed_trades?.length){setClosedTrades(kv.of_closed_trades);ss("of_closed_trades",kv.of_closed_trades);}
  }
}catch(e){/* KV unavailable — localStorage values already applied above */}
setInitDone(true);'''

if src.count(OLD1) == 1:
    src = src.replace(OLD1, NEW1, 1)
    print("✓ Patch 1: KV load block inserted before setInitDone(true)")
else:
    errors.append(f"✗ Patch 1 FAILED: anchor found {src.count(OLD1)} times (expected 1)")

# ─────────────────────────────────────────────────────────────────
# PATCH 2 — Insert kvSyncRef + debounced sync useEffect before WORKER const
# ─────────────────────────────────────────────────────────────────

OLD2 = '''const WORKER = window.location.hostname === "localhost"
   ? "/worker"
   : "https://market.electronmailbag.workers.dev";'''

NEW2 = '''const kvSyncRef = useRef(null);
useEffect(()=>{
  if(!initDone) return;
  clearTimeout(kvSyncRef.current);
  kvSyncRef.current = setTimeout(()=>{
    const payload={
      of_favs:favs,
      of_checks:checks,
      of_ai_updates:aiUpdates,
      of_ai_cards:aiCards,
      of_c123:c123,
      of_journal:journalNotes,
      of_preflight:pfChecks,
      ...(typeof closedTrades!=="undefined"?{of_closed_trades:closedTrades}:{})
    };
    fetch("https://market.electronmailbag.workers.dev/user-data",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    }).catch(()=>{});
  },2000);
},[favs,checks,aiUpdates,aiCards,c123,journalNotes,pfChecks,initDone]);
const WORKER = window.location.hostname === "localhost"
   ? "/worker"
   : "https://market.electronmailbag.workers.dev";'''

if src.count(OLD2) == 1:
    src = src.replace(OLD2, NEW2, 1)
    print("✓ Patch 2: KV debounced sync useEffect added before WORKER const")
else:
    errors.append(f"✗ Patch 2 FAILED: anchor found {src.count(OLD2)} times (expected 1)")

# ─────────────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────────────

if errors:
    print("\nERRORS — file NOT written:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print(f"\n✓ All patches applied. File written ({len(src.splitlines())} lines)")
print("Next: check syntax, then deploy")
