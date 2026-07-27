import sys
PATH = "src/App.jsx"
with open(PATH) as f:
    src = f.read()
errors = []

# ── 1. Add aiCard fallback variables after pfCd declaration ───────────────
A1 = 'const pfCd=candleData[pfSym]?.daily||null;'
B1 = ('const pfCd=candleData[pfSym]?.daily||null;\n'
      'const _pfAi=aiCards[pfSym]||null;\n'
      'const pfOte_low=pfCd?.ote_low??_pfAi?.ote_low??null;\n'
      'const pfOte_high=pfCd?.ote_high??_pfAi?.ote_high??null;\n'
      'const pfSwing=pfCd?.protected_swing??_pfAi?.protected_swing??null;')
if src.count(A1) != 1: errors.append(f"anchor1 count={src.count(A1)}")
else: src = src.replace(A1, B1)

# ── 2. Replace pfCd OTE/swing check computations ─────────────────────────
A2 = ('const pfOteOk=!!(pfCd?.ote_low!=null&&pfCd?.ote_high!=null&&pfLivePrice>=pfCd.ote_low&&pfLivePrice<=pfCd.ote_high);\n'
      'const pfSwingOk=pfCd?.protected_swing!=null?(s.direction==="call"?pfLivePrice>pfCd.protected_swing:pfLivePrice<pfCd.protected_swing):false;')
B2 = ('const pfOteOk=!!(pfOte_low!=null&&pfOte_high!=null&&pfLivePrice>=pfOte_low&&pfLivePrice<=pfOte_high);\n'
      'const pfSwingOk=pfSwing!=null?(s.direction==="call"?pfLivePrice>pfSwing:pfLivePrice<pfSwing):false;')
if src.count(A2) != 1: errors.append(f"anchor2 count={src.count(A2)}")
else: src = src.replace(A2, B2)

# ── 3. Replace OTE display note (the g_ote_auto gate row) ─────────────────
A3 = ('+(pfCd?.ote_low||0).toFixed(2)+"\u2013$"+(pfCd?.ote_high||0).toFixed(2):"$"+pfLivePrice.toFixed(2)+" outside OTE $"+(pfCd?.ote_low||0).toFixed(2)+"\u2013$"+(pfCd?.ote_high||0).toFixed(2)}')
B3 = ('+(pfOte_low||0).toFixed(2)+"\u2013$"+(pfOte_high||0).toFixed(2):"$"+pfLivePrice.toFixed(2)+" outside OTE $"+(pfOte_low||0).toFixed(2)+"\u2013$"+(pfOte_high||0).toFixed(2)}')
if src.count(A3) != 1:
    # Try with literal dash in case em-dash differs
    A3b = ('+(pfCd?.ote_low||0).toFixed(2)+"–$"+(pfCd?.ote_high||0).toFixed(2):"$"+pfLivePrice.toFixed(2)+" outside OTE $"+(pfCd?.ote_low||0).toFixed(2)+"–$"+(pfCd?.ote_high||0).toFixed(2)}')
    B3b = ('+(pfOte_low||0).toFixed(2)+"–$"+(pfOte_high||0).toFixed(2):"$"+pfLivePrice.toFixed(2)+" outside OTE $"+(pfOte_low||0).toFixed(2)+"–$"+(pfOte_high||0).toFixed(2)}')
    if src.count(A3b) != 1: errors.append(f"anchor3 count={src.count(A3)} / {src.count(A3b)}")
    else: src = src.replace(A3b, B3b)
else: src = src.replace(A3, B3)

# ── 4. Replace protected swing display note (g_swing_auto gate row) ────────
A4 = ('note:pfSwingOk?"Price clear of protected swing $"+(pfCd?.protected_swing||0).toFixed(2):"\\u26a0 Price "+(s.direction==="call"?"below":"above")+" protected swing $"+(pfCd?.protected_swing||0).toFixed(2)}')
B4 = ('note:pfSwingOk?"Price clear of protected swing $"+(pfSwing||0).toFixed(2):"\\u26a0 Price "+(s.direction==="call"?"below":"above")+" protected swing $"+(pfSwing||0).toFixed(2)}')
if src.count(A4) != 1:
    # Try with actual warning emoji
    A4b = 'note:pfSwingOk?"Price clear of protected swing $"+(pfCd?.protected_swing||0).toFixed(2):"⚠ Price "+(s.direction==="call"?"below":"above")+" protected swing $"+(pfCd?.protected_swing||0).toFixed(2)}'
    B4b = 'note:pfSwingOk?"Price clear of protected swing $"+(pfSwing||0).toFixed(2):"⚠ Price "+(s.direction==="call"?"below":"above")+" protected swing $"+(pfSwing||0).toFixed(2)}'
    if src.count(A4b) != 1: errors.append(f"anchor4 count={src.count(A4)} / {src.count(A4b)}")
    else: src = src.replace(A4b, B4b)
else: src = src.replace(A4, B4)

if errors:
    print("FAILED:"); [print(" ", e) for e in errors]; sys.exit(1)
with open(PATH, "w") as f: f.write(src)
print("✓ patch_preflight_ote applied — OTE/swing now reads from aiCard when candleData is empty")
