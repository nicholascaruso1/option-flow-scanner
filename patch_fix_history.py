import sys
PATH = "src/App.jsx"
with open(PATH) as f:
    src = f.read()
errors = []

A1 = ('   const resp = await fetch(WORKER+"/analyze",{method:"POST",headers:{"Content-Type":"application/json"},\n'
      '    body:JSON.stringify({ticker:h.ticker,price:h.price,bias:h.bias,retracement:h.details?.retr_pct,conditions:h.conditions,details:h.details})});')
B1 = ('   const existing = h.existingCard||null;\n'
      '   const prevHistory = existing?.analysisHistory||[];\n'
      '   const prevLog = existing?.logEntry?[{ts:existing.dataAsOf||"prior",note:existing.logEntry.note}]:[];\n'
      '   const histCtx = [...prevHistory,...prevLog].slice(-3);\n'
      '   const resp = await fetch(WORKER+"/analyze",{method:"POST",headers:{"Content-Type":"application/json"},\n'
      '    body:JSON.stringify({ticker:h.ticker,price:h.price,bias:h.bias,retracement:h.details?.retr_pct,conditions:h.conditions,details:h.details,historyContext:histCtx.length?histCtx:undefined})});')
if src.count(A1) != 1: errors.append(f"anchor1 count={src.count(A1)}")
else: src = src.replace(A1, B1)

A2 = ('    keyLevels:(a.keyLevels||[]).map(k=>({p:k.p,l:k.l,c:KIND_C[k.kind]||T.gold})),\n'
      '   };\n'
      '   if(!card.symbol) throw new Error("no symbol in analysis");')
B2 = ('    keyLevels:(a.keyLevels||[]).map(k=>({p:k.p,l:k.l,c:KIND_C[k.kind]||T.gold})),\n'
      '    analysisHistory:[...prevHistory,...prevLog].slice(-5),\n'
      '   };\n'
      '   if(!card.symbol) throw new Error("no symbol in analysis");')
if src.count(A2) != 1: errors.append(f"anchor2 count={src.count(A2)}")
else: src = src.replace(A2, B2)

A3 = 'const regenCard = (s) => analyzeHit({ticker:s.symbol, price:s.price, bias:s.direction==="put"?"BEAR":"BULL", retracement:null, conditions:{}, details:{}});'
B3 = ('const regenCard = (s) => {\n'
      '  const existing = aiCards[s.symbol];\n'
      '  const lp = liveData[s.symbol]?.price||s.price;\n'
      '  analyzeHit({ticker:s.symbol,price:lp,bias:(s.direction||s.dir)==="put"?"BEAR":"BULL",retracement:null,conditions:{},details:{},existingCard:existing||null});\n'
      '};')
if src.count(A3) != 1: errors.append(f"anchor3 count={src.count(A3)}")
else: src = src.replace(A3, B3)

A4 = r'{analyzing[s.symbol]?"\u23f3":"\u21bb Regen"}'
B4 = r'{analyzing[s.symbol]?"\u23f3":"\u21bb Regen"+(aiCards[s.symbol]?.analysisHistory?.length>0?" ("+(aiCards[s.symbol].analysisHistory.length)+")":"")}'
count4 = src.count(A4)
if count4 < 1: errors.append(f"anchor4 count={count4} — Regen button")
else: src = src.replace(A4, B4)

if errors:
    print("FAILED:"); [print(" ",e) for e in errors]; sys.exit(1)
with open(PATH,"w") as f: f.write(src)
print(f"✓ patch_fix_history applied — {count4} Regen button(s) updated")
