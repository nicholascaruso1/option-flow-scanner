import sys
PATH = "src/App.jsx"
with open(PATH) as f:
    src = f.read()
errors = []

# ── PATCH 1: Init timing (Bug 2) ──────────────────────────────────────────

A1 = 'const [openScreenerRows, setOpenScreenerRows] = useState({});'
B1 = 'const [openScreenerRows, setOpenScreenerRows] = useState({});\nconst [initDone, setInitDone] = useState(false);'
if src.count(A1) != 1: errors.append(f"P1-A1 count={src.count(A1)}")
else: src = src.replace(A1, B1)

A2 = 'const [f,c,t,ai,mem,c1d,jnl,pfc] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_c123",{}),ls("of_journal",{}),ls("of_preflight",{})]);'
B2 = 'const [f,c,t,ai,mem,c1d,jnl,pfc,ac] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_c123",{}),ls("of_journal",{}),ls("of_preflight",{}),ls("of_ai_cards",{})]);'
if src.count(A2) != 1: errors.append(f"P1-A2 count={src.count(A2)}")
else: src = src.replace(A2, B2)

A3 = 'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setC123(c1d||{}); setJournalNotes(jnl||{}); setPfChecks(pfc||{});'
B3 = 'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setC123(c1d||{}); setJournalNotes(jnl||{}); setPfChecks(pfc||{});\nsetAiCards(ac||{}); setInitDone(true);'
if src.count(A3) != 1: errors.append(f"P1-A3 count={src.count(A3)}")
else: src = src.replace(A3, B3)

# Fixed: no leading \n — match the line itself only
A4 = 'useEffect(()=>{(async()=>{const ac=await ls("of_ai_cards",{});setAiCards(ac||{});})();},[]);'
if src.count(A4) != 1: errors.append(f"P1-A4 count={src.count(A4)}")
else: src = src.replace(A4, '')

A5 = 'useEffect(() => { _doRefreshRef.current?.(); }, []);'
B5 = 'useEffect(() => { if (initDone) _doRefreshRef.current?.(); }, [initDone]);'
if src.count(A5) != 1: errors.append(f"P1-A5 count={src.count(A5)}")
else: src = src.replace(A5, B5)

# ── PATCH 2: History accumulation (Bug 1) ─────────────────────────────────

A6 = ('   const resp = await fetch(WORKER+"/analyze",{method:"POST",headers:{"Content-Type":"application/json"},\n'
      '    body:JSON.stringify({ticker:h.ticker,price:h.price,bias:h.bias,retracement:h.details?.retr_pct,conditions:h.conditions,details:h.details})});')
B6 = ('   const existing = h.existingCard||null;\n'
      '   const prevHistory = existing?.analysisHistory||[];\n'
      '   const prevLog = existing?.logEntry?[{ts:existing.dataAsOf||"prior",note:existing.logEntry.note}]:[];\n'
      '   const histCtx = [...prevHistory,...prevLog].slice(-3);\n'
      '   const resp = await fetch(WORKER+"/analyze",{method:"POST",headers:{"Content-Type":"application/json"},\n'
      '    body:JSON.stringify({ticker:h.ticker,price:h.price,bias:h.bias,retracement:h.details?.retr_pct,conditions:h.conditions,details:h.details,historyContext:histCtx.length?histCtx:undefined})});')
if src.count(A6) != 1: errors.append(f"P2-A6 count={src.count(A6)}")
else: src = src.replace(A6, B6)

A7 = ('    keyLevels:(a.keyLevels||[]).map(k=>({p:k.p,l:k.l,c:KIND_C[k.kind]||T.gold})),\n'
      '   };\n'
      '   if(!card.symbol) throw new Error("no symbol in analysis");')
B7 = ('    keyLevels:(a.keyLevels||[]).map(k=>({p:k.p,l:k.l,c:KIND_C[k.kind]||T.gold})),\n'
      '    analysisHistory:[...prevHistory,...prevLog].slice(-5),\n'
      '   };\n'
      '   if(!card.symbol) throw new Error("no symbol in analysis");')
if src.count(A7) != 1: errors.append(f"P2-A7 count={src.count(A7)}")
else: src = src.replace(A7, B7)

A8 = 'const regenCard = (s) => analyzeHit({ticker:s.symbol, price:s.price, bias:s.direction==="put"?"BEAR":"BULL", retracement:null, conditions:{}, details:{}});'
B8 = ('const regenCard = (s) => {\n'
      '  const existing = aiCards[s.symbol];\n'
      '  const lp = liveData[s.symbol]?.price||s.price;\n'
      '  analyzeHit({ticker:s.symbol,price:lp,bias:(s.direction||s.dir)==="put"?"BEAR":"BULL",retracement:null,conditions:{},details:{},existingCard:existing||null});\n'
      '};')
if src.count(A8) != 1: errors.append(f"P2-A8 count={src.count(A8)}")
else: src = src.replace(A8, B8)

A9 = r'{analyzing[s.symbol]?"\u23f3":"\u21bb Regen"}'
B9 = r'{analyzing[s.symbol]?"\u23f3":"\u21bb Regen"+(aiCards[s.symbol]?.analysisHistory?.length>0?" ("+(aiCards[s.symbol].analysisHistory.length)+")":"")}'
count9 = src.count(A9)
if count9 < 1: errors.append(f"P2-A9 count={count9} — Regen button")
else: src = src.replace(A9, B9)

if errors:
    print("FAILED — no file written:")
    [print(" ", e) for e in errors]
    sys.exit(1)

with open(PATH, "w") as f:
    f.write(src)
print(f"✓ All patches applied — {count9} Regen button(s) updated")
