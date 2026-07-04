#!/usr/bin/env python3
"""
patch_screener_upgrade.py
Applies three upgrades to ~/option-flow-scanner/src/App.jsx:
  1. Screener rows → rich cards with retracement bar, 5-segment score bar,
     auto-generated signal line, and memory context.
  2. Screener sort + bias filter controls.
  3. Alignment score badge on setup cards (Options view).
"""

import sys, re

PATH = "/Users/nick/option-flow-scanner/src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

errors = []

# ─────────────────────────────────────────────────────────────────
# CHANGE 1 — Add scrSort + scrBias state vars after screenerLoading
# ─────────────────────────────────────────────────────────────────

OLD_STATE = " const [screenerLoading, setScreenerLoading] = useState(true);"
NEW_STATE = """ const [screenerLoading, setScreenerLoading] = useState(true);
 const [scrSort, setScrSort] = useState("score");
 const [scrBias, setScrBias] = useState("all");"""

if OLD_STATE in src:
    src = src.replace(OLD_STATE, NEW_STATE, 1)
    print("✓ Change 1: screener state vars added")
else:
    errors.append("✗ Change 1 FAILED: screenerLoading state anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 2 — Add alScore const inside the setup card loop
# ─────────────────────────────────────────────────────────────────

OLD_ALSCORE = " const allCk=[...new Set([...ck,...effectiveAutoChecks])];\n const pct=Math.round((allCk.length/CHECKLIST.length)*100);\n const dc=s.direction==="
NEW_ALSCORE = """ const allCk=[...new Set([...ck,...effectiveAutoChecks])];
 const pct=Math.round((allCk.length/CHECKLIST.length)*100);
 const alScore=alignmentScore(s);
 const dc=s.direction===\""""

if " const allCk=[...new Set([...ck,...effectiveAutoChecks])];\n const pct=Math.round((allCk.length/CHECKLIST.length)*100);\n const dc=s.direction===" in src:
    src = src.replace(
        " const allCk=[...new Set([...ck,...effectiveAutoChecks])];\n const pct=Math.round((allCk.length/CHECKLIST.length)*100);\n const dc=s.direction===\"",
        " const allCk=[...new Set([...ck,...effectiveAutoChecks])];\n const pct=Math.round((allCk.length/CHECKLIST.length)*100);\n const alScore=alignmentScore(s);\n const dc=s.direction===\"",
        1
    )
    print("✓ Change 2a: alScore const inserted in setup card loop")
else:
    errors.append("✗ Change 2a FAILED: allCk/pct/dc anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 2b — Replace "⚡ Top Aligned" pill row to include alScore badge
# ─────────────────────────────────────────────────────────────────

OLD_PILLS = (
    " {vIdx===0&&!invAlert&&!s.isActive&&view!==\"managing\"&&<span style={pill(T.teal)}>⚡ Top Aligned</span>}\n"
    " <span style={pill(ac)}>{ph.icon} {ph.label}</span>\n"
    " <span style={pill(dc)}>{s.direction===\"call\"?\"Call ↑\":s.direction===\"put\"?\"Put ↓\":\"Watch\"}</span>\n"
    " <span style={pill(CAP_COLORS[s.capSize]||T.slate)}>{s.capSize} · {s.mcap}</span>\n"
    " {s.retailTrap&&<span style={pill(T.purple)}>🪤 Divergence</span>}\n"
    " {earnD!=null&&<span style={pill(earnC)}>Earnings {s.earningsLabel} · {earnD}d</span>}\n"
    " {dteD!=null&&<span style={pill(dteD<=7?T.rose:T.border2)}>Exp {dteD}d</span>}\n"
    " {allCk.length>0&&<span style={pill(T.sage)}>✓ {allCk.length}/{CHECKLIST.length}</span>}\n"
    " {invAlert&&<span style={pill(T.rose)}>⚠ INVALIDATED</span>}\n"
)

NEW_PILLS = (
    " {vIdx===0&&!invAlert&&!s.isActive&&view!==\"managing\"&&<span style={pill(T.teal)}>⚡ Top Aligned</span>}\n"
    " <span style={pill(ac)}>{ph.icon} {ph.label}</span>\n"
    " <span style={pill(dc)}>{s.direction===\"call\"?\"Call ↑\":s.direction===\"put\"?\"Put ↓\":\"Watch\"}</span>\n"
    " <span style={pill(CAP_COLORS[s.capSize]||T.slate)}>{s.capSize} · {s.mcap}</span>\n"
    " {s.retailTrap&&<span style={pill(T.purple)}>🪤 Divergence</span>}\n"
    " {earnD!=null&&<span style={pill(earnC)}>Earnings {s.earningsLabel} · {earnD}d</span>}\n"
    " {dteD!=null&&<span style={pill(dteD<=7?T.rose:T.border2)}>Exp {dteD}d</span>}\n"
    " {allCk.length>0&&<span style={pill(T.sage)}>✓ {allCk.length}/{CHECKLIST.length}</span>}\n"
    " {alScore>0&&!invAlert&&<span style={pill(alScore>=70?T.sage:alScore>=35?T.gold:T.textDim)} title=\"Alignment score: phase + checklist + key-level proximity\">Align {alScore}</span>}\n"
    " {invAlert&&<span style={pill(T.rose)}>⚠ INVALIDATED</span>}\n"
)

if OLD_PILLS in src:
    src = src.replace(OLD_PILLS, NEW_PILLS, 1)
    print("✓ Change 2b: Alignment score badge added to setup card pills")
else:
    errors.append("✗ Change 2b FAILED: pills row anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 3 — Replace entire screener IIFE with upgraded version
# ─────────────────────────────────────────────────────────────────

OLD_SCREENER = """ {view===\"screener\"&&(()=>{
 const setupSymbols=new Set(SETUPS.map(s=>s.symbol));
 const newHits=screenerHits.filter(h=>!setupSymbols.has(h.ticker));
 const trackedHits=screenerHits.filter(h=>setupSymbols.has(h.ticker));
 const condKeys=[\"topdown_bias\",\"expansion\",\"in_zone\",\"vol_confirm\",\"liquid\"];
 const condLabels={\"topdown_bias\":\"Top-Down\",\"expansion\":\"Expansion\",\"in_zone\":\"0-50% Zone\",\"vol_confirm\":\"Vol Confirm\",\"liquid\":\"Liquid\"};
 const dot=(on)=><div style={{width:6,height:6,borderRadius:\"50%\",background:on?T.green:T.border2,display:\"inline-block\",margin:\"0 2px\"}}/>;
 const biasColor=b=>b===\"BULL\"?T.green:T.rose;
 const doReload=()=>{setScreenerLoading(true);fetch(\"./data/stocks.json?_=\"+Date.now()).then(r=>r.json()).then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);}).catch(()=>setScreenerLoading(false));};
 const renderRow=(h)=>(
 <div key={h.ticker} style={{padding:\"10px 14px\",borderBottom:\"1px solid \"+T.border,display:\"flex\",alignItems:\"center\",gap:10,flexWrap:\"wrap\"}}>
 <div style={{minWidth:52}}>
 <div style={{fontSize:13,fontWeight:700,color:T.textPri,fontFamily:FM}}>{h.ticker}</div>
 <div style={{fontSize:10,color:T.textDim,fontFamily:FD}}>${h.price.toFixed(2)}</div>
 </div>
 <div style={{background:biasColor(h.bias)+\"22\",color:biasColor(h.bias),fontSize:9,fontWeight:700,padding:\"2px 7px\",borderRadius:3,border:\"1px solid \"+biasColor(h.bias)+\"44\",letterSpacing:\"0.08em\"}}>{h.bias===\"BULL\"?\"^ CALL\":\"v PUT\"}</div>
 <div style={{display:\"flex\",alignItems:\"center\",gap:2}}>
 {condKeys.map(k=><span key={k} title={condLabels[k]}>{dot(h.conditions[k])}</span>)}
 <span style={{fontSize:9,color:h.met===5?T.green:T.textDim,fontWeight:h.met===5?700:400,marginLeft:4,fontFamily:FD}}>{h.met}/5</span>
 </div>
 <div style={{fontSize:9,color:T.textSec,fontFamily:FD}}>Retr {h.details.retr_pct}%</div>
 <div style={{fontSize:9,color:T.textDim,fontFamily:FD}}>Exp {h.details.exp_date}</div>
 {setupSymbols.has(h.ticker)&&<div style={{fontSize:8,color:T.gold,letterSpacing:\"0.08em\",textTransform:\"uppercase\",marginLeft:\"auto\"}}>* In Scanner</div>}
 </div>
 );
 return(
 <div style={{padding:16}}>
 {screenerLoading&&<div style={{textAlign:\"center\",padding:32,color:T.textDim,fontSize:12,fontFamily:FM}}>Loading screener data...</div>}
 {!screenerLoading&&screenerHits.length===0&&(
 <div style={{textAlign:\"center\",padding:32,color:T.textDim}}>
 <div style={{fontSize:12,fontFamily:FM}}>No screener data found</div>
 <div style={{fontSize:10,color:T.border2,marginTop:4,fontFamily:FD}}>Trigger CI workflow manually from GitHub Actions</div>
 <button onClick={doReload} style={{marginTop:12,fontSize:9,padding:\"5px 14px\",background:T.surface,border:\"1px solid \"+T.border,color:T.textSec,borderRadius:4,cursor:\"pointer\",fontFamily:FM}}>Retry</button>
 </div>
 )}
 {!screenerLoading&&screenerHits.length>0&&(
 <>
 <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"flex-start\",marginBottom:12}}>
 <div>
 <div style={{fontSize:11,fontWeight:700,color:T.textPri,fontFamily:FM,letterSpacing:\"0.05em\"}}>SCREENER HITS</div>
 <div style={{fontSize:9,color:T.textDim,fontFamily:FD,marginTop:3}}>
 {screenerMeta.universe_size} stocks / {screenerHits.length} candidates / {screenerMeta.generated_at?new Date(screenerMeta.generated_at).toLocaleString(\"en-US\",{month:\"short\",day:\"numeric\",hour:\"numeric\",minute:\"2-digit\"}):\"\"}
 </div>
 </div>
 <button onClick={doReload} style={{fontSize:9,padding:\"4px 10px\",background:T.surface,border:\"1px solid \"+T.border,color:T.textSec,borderRadius:4,cursor:\"pointer\",fontFamily:FM,flexShrink:0}}>Refresh</button>
 </div>
 {newHits.length>0&&(
 <div style={{background:T.surface,border:\"1px solid \"+T.border,borderRadius:6,overflow:\"hidden\",marginBottom:10}}>
 <div style={{padding:\"8px 14px\",borderBottom:\"1px solid \"+T.border,display:\"flex\",alignItems:\"center\",gap:6,background:T.bg}}>
 <div style={{width:6,height:6,borderRadius:\"50%\",background:T.green,flexShrink:0}}/>
 <span style={{fontSize:9,fontWeight:700,color:T.green,letterSpacing:\"0.1em\",textTransform:\"uppercase\",fontFamily:FM}}>New Candidates</span>
 <span style={{fontSize:9,color:T.textDim,marginLeft:\"auto\"}}>{newHits.length} not yet in scanner</span>
 </div>
 {newHits.sort((a,b)=>b.met-a.met).map(renderRow)}
 </div>
 )}
 {trackedHits.length>0&&(
 <div style={{background:T.surface,border:\"1px solid \"+T.border,borderRadius:6,overflow:\"hidden\",marginBottom:10}}>
 <div style={{padding:\"8px 14px\",borderBottom:\"1px solid \"+T.border,display:\"flex\",alignItems:\"center\",gap:6,background:T.bg}}>
 <div style={{width:6,height:6,borderRadius:\"50%\",background:T.gold,flexShrink:0}}/>
 <span style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:\"0.1em\",textTransform:\"uppercase\",fontFamily:FM}}>Already Tracked</span>
 <span style={{fontSize:9,color:T.textDim,marginLeft:\"auto\"}}>Screener confirms open setups</span>
 </div>
 {trackedHits.map(renderRow)}
 </div>
 )}
 <div style={{display:\"flex\",gap:12,flexWrap:\"wrap\",marginTop:6,padding:\"8px 0\",borderTop:\"1px solid \"+T.border}}>
 {condKeys.map(k=>(
 <div key={k} style={{display:\"flex\",alignItems:\"center\",gap:4}}>
 {dot(true)}
 <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>{condLabels[k]}</span>
 </div>
 ))}
 </div>
 </>
 )}
 </div>
 );
 })()}"""

NEW_SCREENER = """ {view===\"screener\"&&(()=>{
 const setupSymbols=new Set(SETUPS.map(s=>s.symbol));
 const condKeys=[\"topdown_bias\",\"expansion\",\"in_zone\",\"vol_confirm\",\"liquid\"];
 const condLabels={\"topdown_bias\":\"Top-Down Bias\",\"expansion\":\"Expansion\",\"in_zone\":\"0–50% Zone\",\"vol_confirm\":\"Vol Confirm\",\"liquid\":\"Liquid\"};
 const biasColor=b=>b===\"BULL\"?T.sage:T.rose;
 const doReload=()=>{setScreenerLoading(true);fetch(\"./data/stocks.json?_=\"+Date.now()).then(r=>r.json()).then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);}).catch(()=>setScreenerLoading(false));};

 const generateSignalLine=(h)=>{
 const parts=[];
 if(h.conditions.topdown_bias) parts.push(\"top-down bias aligned\");
 if(h.conditions.expansion) parts.push(\"expansion candle confirmed\");
 if(h.conditions.in_zone) parts.push(`in 0–50% retracement zone (${h.details.retr_pct}%)`);
 if(h.conditions.vol_confirm) parts.push(\"expansion-day volume confirmed\");
 if(!h.conditions.in_zone&&h.met>=3) parts.push(\"awaiting zone entry\");
 if(parts.length===0) return null;
 const bias=h.bias===\"BULL\"?\"Bullish\":\"Bearish\";
 return `${bias} setup: ${parts.slice(0,3).join(\", \")}.`;
 };

 const sortFn=(a,b)=>{
 if(scrSort===\"score\") return b.met-a.met;
 if(scrSort===\"retr\") return parseFloat(a.details.retr_pct)-parseFloat(b.details.retr_pct);
 if(scrSort===\"ticker\") return a.ticker.localeCompare(b.ticker);
 return b.met-a.met;
 };
 const biasFn=(h)=>scrBias===\"all\"||h.bias===scrBias;

 const allFiltered=screenerHits.filter(biasFn).sort(sortFn);
 const newHits=allFiltered.filter(h=>!setupSymbols.has(h.ticker));
 const trackedHits=allFiltered.filter(h=>setupSymbols.has(h.ticker));

 const renderCard=(h)=>{
 const bc=biasColor(h.bias);
 const retrFill=Math.min(100,Math.max(0,parseFloat(h.details.retr_pct)*2));
 const signalLine=generateSignalLine(h);
 const memHist=memoryData[h.ticker]||[];
 const lastSnap=memHist[memHist.length-1];
 return(
 <div key={h.ticker} style={{padding:\"12px 14px\",borderBottom:\"1px solid \"+T.border,background:h.met===5?bc+\"06\":\"transparent\"}}>
 <div style={{display:\"flex\",alignItems:\"center\",gap:8,marginBottom:7}}>
 <div style={{minWidth:56}}>
 <div style={{fontSize:14,fontWeight:700,color:T.textPri,fontFamily:FM}}>{h.ticker}</div>
 <div style={{fontSize:9,color:T.textDim,fontFamily:FD}}>${h.price.toFixed(2)}</div>
 </div>
 <div style={{background:bc+\"22\",color:bc,fontSize:9,fontWeight:700,padding:\"3px 8px\",borderRadius:3,border:\"1px solid \"+bc+\"44\",letterSpacing:\"0.08em\"}}>{h.bias===\"BULL\"?\"▲ CALL\":\"▼ PUT\"}</div>
 {h.met===5&&<div style={{fontSize:8,padding:\"2px 6px\",background:T.sage+\"22\",border:\"1px solid \"+T.sage+\"50\",borderRadius:3,color:T.sage,letterSpacing:\"0.07em\",fontWeight:700}}>5/5 ✓</div>}
 {setupSymbols.has(h.ticker)&&<div style={{fontSize:8,color:T.gold,letterSpacing:\"0.08em\",textTransform:\"uppercase\",marginLeft:\"auto\",fontWeight:600}}>★ Tracked</div>}
 </div>
 <div style={{display:\"flex\",gap:3,marginBottom:7}} title=\"Each segment = one condition met\">
 {condKeys.map(k=>(
 <div key={k} title={condLabels[k]} style={{flex:1,height:4,borderRadius:2,background:h.conditions[k]?bc:T.border2,transition:\"background 0.2s\"}}/>
 ))}
 </div>
 <div style={{display:\"flex\",alignItems:\"center\",gap:10,marginBottom:signalLine?7:0}}>
 <div style={{flex:1}}>
 <div style={{fontSize:7,color:T.textDim,fontFamily:FD,marginBottom:3,display:\"flex\",justifyContent:\"space-between\"}}>
 <span>0%</span><span>Retr {h.details.retr_pct}% into zone</span><span>50%</span>
 </div>
 <div style={{height:3,background:T.border,borderRadius:2,overflow:\"hidden\"}}>
 <div style={{height:\"100%\",borderRadius:2,background:bc,width:retrFill+\"%\"}}/>
 </div>
 </div>
 <span style={{fontSize:9,color:h.met===5?T.sage:T.textSec,fontWeight:h.met===5?700:400,fontFamily:FD,flexShrink:0}}>{h.met}/5</span>
 <span style={{fontSize:8,color:T.textDim,fontFamily:FD,flexShrink:0}}>Exp {h.details.exp_date}</span>
 </div>
 {signalLine&&(
 <div style={{fontSize:9,color:T.textSec,lineHeight:1.5,padding:\"5px 8px\",background:T.bg,borderRadius:3,border:\"1px solid \"+T.border}}>
 → {signalLine}
 </div>
 )}
 {memHist.length>=2&&setupSymbols.has(h.ticker)&&lastSnap&&(
 <div style={{marginTop:5,fontSize:8,color:T.teal,fontFamily:FM}}>
 📅 {memHist.length} sessions tracked · {lastSnap.phase||\"—\"} phase
 </div>
 )}
 </div>
 );
 };

 const selS={background:T.bg,border:\"1px solid \"+T.border,color:T.textPri,padding:\"4px 8px\",fontSize:9,borderRadius:3,fontFamily:FM,outline:\"none\",cursor:\"pointer\"};
 return(
 <div style={{padding:16}}>
 {screenerLoading&&<div style={{textAlign:\"center\",padding:32,color:T.textDim,fontSize:12,fontFamily:FM}}>Loading screener data...</div>}
 {!screenerLoading&&screenerHits.length===0&&(
 <div style={{textAlign:\"center\",padding:32,color:T.textDim}}>
 <div style={{fontSize:12,fontFamily:FM}}>No screener data found</div>
 <div style={{fontSize:10,color:T.border2,marginTop:4,fontFamily:FD}}>Trigger CI workflow manually from GitHub Actions</div>
 <button onClick={doReload} style={{marginTop:12,fontSize:9,padding:\"5px 14px\",background:T.surface,border:\"1px solid \"+T.border,color:T.textSec,borderRadius:4,cursor:\"pointer\",fontFamily:FM}}>Retry</button>
 </div>
 )}
 {!screenerLoading&&screenerHits.length>0&&(
 <>
 <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"flex-start\",marginBottom:10}}>
 <div>
 <div style={{fontSize:11,fontWeight:700,color:T.textPri,fontFamily:FM,letterSpacing:\"0.05em\"}}>📡 SCREENER HITS</div>
 <div style={{fontSize:9,color:T.textDim,fontFamily:FD,marginTop:3}}>
 {screenerMeta.universe_size} stocks / {screenerHits.length} candidates / {screenerMeta.generated_at?new Date(screenerMeta.generated_at).toLocaleString(\"en-US\",{month:\"short\",day:\"numeric\",hour:\"numeric\",minute:\"2-digit\"}):\"\"}
 </div>
 </div>
 <button onClick={doReload} style={{fontSize:9,padding:\"4px 10px\",background:T.surface,border:\"1px solid \"+T.border,color:T.textSec,borderRadius:4,cursor:\"pointer\",fontFamily:FM,flexShrink:0}}>Refresh</button>
 </div>
 <div style={{display:\"flex\",gap:8,alignItems:\"center\",flexWrap:\"wrap\",marginBottom:12,padding:\"8px 10px\",background:T.surface,border:\"1px solid \"+T.border,borderRadius:5}}>
 <div style={{display:\"flex\",alignItems:\"center\",gap:5}}>
 <span style={{fontSize:8,color:T.textDim,textTransform:\"uppercase\",letterSpacing:\"0.1em\",fontFamily:FM}}>Sort</span>
 <select value={scrSort} onChange={e=>setScrSort(e.target.value)} style={selS}>
 <option value=\"score\">Score ↓</option>
 <option value=\"retr\">Retracement %</option>
 <option value=\"ticker\">Ticker A–Z</option>
 </select>
 </div>
 <div style={{display:\"flex\",alignItems:\"center\",gap:5}}>
 <span style={{fontSize:8,color:T.textDim,textTransform:\"uppercase\",letterSpacing:\"0.1em\",fontFamily:FM}}>Bias</span>
 <select value={scrBias} onChange={e=>setScrBias(e.target.value)} style={selS}>
 <option value=\"all\">All</option>
 <option value=\"BULL\">Calls ▲</option>
 <option value=\"BEAR\">Puts ▼</option>
 </select>
 </div>
 <span style={{fontSize:8,color:T.textDim,fontFamily:FD,marginLeft:\"auto\"}}>{allFiltered.length} shown</span>
 </div>
 {newHits.length>0&&(
 <div style={{background:T.surface,border:\"1px solid \"+T.border,borderRadius:6,overflow:\"hidden\",marginBottom:10}}>
 <div style={{padding:\"8px 14px\",borderBottom:\"1px solid \"+T.border,display:\"flex\",alignItems:\"center\",gap:6,background:T.bg}}>
 <div style={{width:6,height:6,borderRadius:\"50%\",background:T.sage,flexShrink:0}}/>
 <span style={{fontSize:9,fontWeight:700,color:T.sage,letterSpacing:\"0.1em\",textTransform:\"uppercase\",fontFamily:FM}}>New Candidates</span>
 <span style={{fontSize:9,color:T.textDim,marginLeft:\"auto\"}}>{newHits.length} not yet in scanner</span>
 </div>
 {newHits.map(renderCard)}
 </div>
 )}
 {trackedHits.length>0&&(
 <div style={{background:T.surface,border:\"1px solid \"+T.border,borderRadius:6,overflow:\"hidden\",marginBottom:10}}>
 <div style={{padding:\"8px 14px\",borderBottom:\"1px solid \"+T.border,display:\"flex\",alignItems:\"center\",gap:6,background:T.bg}}>
 <div style={{width:6,height:6,borderRadius:\"50%\",background:T.gold,flexShrink:0}}/>
 <span style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:\"0.1em\",textTransform:\"uppercase\",fontFamily:FM}}>Already Tracked</span>
 <span style={{fontSize:9,color:T.textDim,marginLeft:\"auto\"}}>Screener confirms open setups</span>
 </div>
 {trackedHits.map(renderCard)}
 </div>
 )}
 <div style={{display:\"flex\",gap:10,flexWrap:\"wrap\",marginTop:6,padding:\"8px 0\",borderTop:\"1px solid \"+T.border,alignItems:\"center\"}}>
 <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>Conditions:</span>
 {condKeys.map(k=>(
 <div key={k} style={{display:\"flex\",alignItems:\"center\",gap:3}}>
 <div style={{width:8,height:4,borderRadius:2,background:T.sage}}/>
 <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>{condLabels[k]}</span>
 </div>
 ))}
 </div>
 </>
 )}
 </div>
 );
 })()}"""

if OLD_SCREENER in src:
    src = src.replace(OLD_SCREENER, NEW_SCREENER, 1)
    print("✓ Change 3: Screener IIFE replaced with upgraded card version")
else:
    errors.append("✗ Change 3 FAILED: screener IIFE anchor not found")

# ─────────────────────────────────────────────────────────────────
# Write output or report errors
# ─────────────────────────────────────────────────────────────────

if errors:
    print("\n--- ERRORS ---")
    for e in errors:
        print(e)
    print("\nFile NOT written. Fix anchors and retry.")
    sys.exit(1)
else:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src)
    print("\n✓ All changes applied. File written to", PATH)
    print("Next: git add src/App.jsx && git commit -m 'Screener cards, sort/filter, alignment score badge' && npm run deploy")
