#!/usr/bin/env python3
"""Restores the Close Trade Modal system that ChatGPT removed.
Run: python3 restore_close_modal.py
"""
import os, sys

PATH = os.path.expanduser("~/option-flow-scanner/src/App.jsx")
if not os.path.exists(PATH):
    print(f"ERROR: {PATH} not found"); sys.exit(1)

src = open(PATH, "r", encoding="utf-8").read()
print(f"Input: {len(src.splitlines())} lines")

PATCHES = []

PATCHES.append((
    ' const [screenerLoading, setScreenerLoading] = useState(true);',
    ' const [screenerLoading, setScreenerLoading] = useState(true);\n const [closeModal, setCloseModal] = useState(null);\n const [exitPrice, setExitPrice] = useState("");\n const [exitReason, setExitReason] = useState("TARGET_HIT");\n const [exitNotes, setExitNotes] = useState("");\n const [closedTrades, setClosedTrades] = useState([]);',
    "state variables"
))
PATCHES.append((
    'const [f,c,t,ai,mem] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{})]);',
    'const [f,c,t,ai,mem,ct] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_closed_trades",[])]);',
    "closedTrades ls load"
))
PATCHES.append((
    'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{});',
    'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setClosedTrades(ct||[]);',
    "closedTrades setState"
))
PATCHES.append((
    ' const WORKER = window.location.hostname === "localhost"\n   ? "/worker"\n   : "https://market.electronmailbag.workers.dev";',
    ' const submitClose = useCallback(() => {\n  if (!closeModal || !exitPrice) return;\n  const ep = parseFloat(exitPrice);\n  const entry = closeModal.setup.entryPremium;\n  const pct = entry ? ((ep - entry) / entry) * 100 : null;\n  const trade = {\n   id: Date.now(),\n   symbol: closeModal.symbol,\n   contract: closeModal.setup.contract,\n   direction: closeModal.setup.direction,\n   entryPremium: entry,\n   exitPremium: ep,\n   pct: pct ? parseFloat(pct.toFixed(1)) : null,\n   reason: exitReason,\n   notes: exitNotes,\n   closedAt: new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}),\n  };\n  setClosedTrades(prev => {\n   const next = [trade, ...prev];\n   ss("of_closed_trades", next);\n   return next;\n  });\n  setCloseModal(null);\n  setExitPrice("");\n  setExitReason("TARGET_HIT");\n  setExitNotes("");\n }, [closeModal, exitPrice, exitReason, exitNotes]);\n\n const WORKER = window.location.hostname === "localhost"\n   ? "/worker"\n   : "https://market.electronmailbag.workers.dev";',
    "submitClose handler"
))
PATCHES.append((
    '{[["managing","📊 Positions"],["budget","💰 Budget"]].map(([v,l])=>(',
    '{[["managing","📊 Positions"],["budget","💰 Budget"],["closed","📋 Closed"]].map(([v,l])=>(',
    "panel tabs"
))
OLD5 = ' <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>\n {dtD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:(dtD<=7?T.rose:T.border2)+"18",border:"1px solid "+(dtD<=7?T.rose:T.border2)+"44",borderRadius:3,color:dtD<=7?T.rose:T.textDim}}>Exp {dtD}d</span>}\n {earnD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:earnC+"18",border:"1px solid "+earnC+"44",borderRadius:3,color:earnC}}>Earnings {s.earningsLabel} · {earnD}d</span>}\n </div>\n </div>\n );\n })}'
NEW5 = ' <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>\n {dtD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:(dtD<=7?T.rose:T.border2)+"18",border:"1px solid "+(dtD<=7?T.rose:T.border2)+"44",borderRadius:3,color:dtD<=7?T.rose:T.textDim}}>Exp {dtD}d</span>}\n {earnD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:earnC+"18",border:"1px solid "+earnC+"44",borderRadius:3,color:earnC}}>Earnings {s.earningsLabel} · {earnD}d</span>}\n </div>\n <button onClick={()=>{setCloseModal({symbol:s.symbol,setup:s});setPanelOpen(false);}} style={{marginTop:8,width:"100%",padding:"6px",fontSize:9,background:T.rose+"15",border:"1px solid "+T.rose+"50",borderRadius:3,color:T.rose,cursor:"pointer",fontFamily:FM}}>✕ Close Trade</button>\n </div>\n );\n })}'
PATCHES.append((OLD5, NEW5, "panel close button"))
OLD6 = ' <div style={{marginTop:10,fontSize:9,color:T.textDim,lineHeight:1.7}}>5% risk constant as account grows. IRA ≤$200/contract · Individual ≤$5/contract.</div>\n </div>\n );\n })()}\n </div>\n )}\n </div>\n'
NEW6 = ' <div style={{marginTop:10,fontSize:9,color:T.textDim,lineHeight:1.7}}>5% risk constant as account grows. IRA ≤$200/contract · Individual ≤$5/contract.</div>\n </div>\n );\n })()}\n {view==="closed"&&(\n  <div style={{padding:"12px 14px",maxHeight:400,overflowY:"auto"}}>\n   <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:10,letterSpacing:"0.05em"}}>CLOSED TRADES · {closedTrades.length} total</div>\n   {closedTrades.length===0&&<div style={{fontSize:10,color:T.textSec,textAlign:"center",padding:"20px 0"}}>No closed trades yet</div>}\n   {closedTrades.length>0&&(()=>{\n    const wins=closedTrades.filter(t=>t.pct>=0);\n    const winRate=Math.round((wins.length/closedTrades.length)*100);\n    const avgRet=closedTrades.reduce((s,t)=>s+(t.pct||0),0)/closedTrades.length;\n    const best=closedTrades.reduce((b,t)=>(t.pct||0)>(b.pct||0)?t:b,closedTrades[0]);\n    return(\n     <>\n     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>\n      {[["Win Rate",winRate+"%",winRate>=50?T.sage:T.rose],["Avg Return",(avgRet>=0?"+":"")+avgRet.toFixed(1)+"%",avgRet>=0?T.sage:T.rose],["Best",best?(best.pct>=0?"+":"")+best.pct.toFixed(1)+"%":"—",T.gold]].map(([l,v,c])=>(\n       <div key={l} style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"8px 6px",textAlign:"center"}}>\n        <div style={{fontSize:8,color:T.textDim,marginBottom:3}}>{l}</div>\n        <div style={{fontSize:12,fontWeight:700,color:c,fontFamily:FD}}>{v}</div>\n       </div>\n      ))}\n     </div>\n     {closedTrades.map(t=>(\n      <div key={t.id} style={{marginBottom:6,padding:"8px 10px",background:T.bg,border:"1px solid "+T.border,borderRadius:4,borderLeft:"2px solid "+(t.pct>=0?T.sage:T.rose)}}>\n       <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>\n        <span style={{fontFamily:FD,fontSize:11,fontWeight:700,color:T.textPri}}>{t.symbol}</span>\n        <span style={{fontFamily:FD,fontSize:12,fontWeight:700,color:t.pct>=0?T.sage:T.rose}}>{t.pct!=null?(t.pct>=0?"+":"")+t.pct.toFixed(1)+"%":"—"}</span>\n       </div>\n       <div style={{fontSize:8,color:T.textDim,marginTop:2}}>{t.contract} · {t.reason.replace(/_/g," ")}</div>\n       <div style={{fontSize:8,color:T.textDim}}>{t.closedAt}</div>\n       {t.notes&&<div style={{fontSize:9,color:T.textSec,marginTop:4,fontStyle:"italic"}}>{t.notes}</div>}\n      </div>\n     ))}\n     </>\n    );\n   })()}\n  </div>\n )}\n </div>\n )}\n </div>\n'
PATCHES.append((OLD6, NEW6, "closed tab content"))
OLD7 = ' <div style={{display:"flex",gap:8,marginTop:8,paddingBottom:10,flexWrap:"wrap",alignItems:"center"}}>\n <span style={{fontSize:9,color:T.textDim,fontFamily:FD}}>Vol {dispVol}</span>\n {s.accountFit.map((a,i)=><span key={i} style={{fontSize:9,color:T.textDim}}>💼 {a}</span>)}\n </div>\n </div>\n'
NEW7 = ' <div style={{display:"flex",gap:8,marginTop:8,paddingBottom:10,flexWrap:"wrap",alignItems:"center"}}>\n <span style={{fontSize:9,color:T.textDim,fontFamily:FD}}>Vol {dispVol}</span>\n {s.accountFit.map((a,i)=><span key={i} style={{fontSize:9,color:T.textDim}}>💼 {a}</span>)}\n {s.isActive&&<button onClick={()=>setCloseModal({symbol:s.symbol,setup:s})} style={{marginLeft:"auto",padding:"3px 10px",fontSize:9,background:T.rose+"15",border:"1px solid "+T.rose+"50",borderRadius:3,color:T.rose,cursor:"pointer",fontFamily:FM}}>✕ Close Trade</button>}\n </div>\n </div>\n'
PATCHES.append((OLD7, NEW7, "main card close button"))
PATCHES.append((
    ' <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}',
    ' <CloseTradeModal\n  closeModal={closeModal}\n  exitPrice={exitPrice}\n  setExitPrice={setExitPrice}\n  exitReason={exitReason}\n  setExitReason={setExitReason}\n  exitNotes={exitNotes}\n  setExitNotes={setExitNotes}\n  onClose={()=>setCloseModal(null)}\n  onSubmit={submitClose}\n  T={T}\n  FD={FD}\n  FM={FM}\n />\n <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}',
    "modal invocation"
))
OLD9 = 'const TL_STEPS = ["EXPANSION","CONSOLIDATION","RETRACEMENT","READY","MANAGING"];\nexport default function OptionsScanner() {'
NEW9 = 'const TL_STEPS = ["EXPANSION","CONSOLIDATION","RETRACEMENT","READY","MANAGING"];\n\nfunction CloseTradeModal({closeModal,exitPrice,setExitPrice,exitReason,setExitReason,exitNotes,setExitNotes,onClose,onSubmit,T,FD,FM}) {\n if (!closeModal) return null;\n const entry = closeModal.setup.entryPremium;\n const parsed = parseFloat(exitPrice);\n const pct = exitPrice && entry ? ((parsed - entry) / entry) * 100 : null;\n const isUp = pct != null && pct >= 0;\n return (\n  <div style={{position:"fixed",inset:0,background:"#000000AA",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>\n   <div style={{background:T.surface,border:"1px solid "+T.border2,borderRadius:8,padding:20,width:"100%",maxWidth:340,boxShadow:"0 16px 48px #000000AA"}}>\n    <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:T.textPri,marginBottom:2}}>Close Trade · {closeModal.symbol}</div>\n    <div style={{fontSize:9,color:T.textDim,marginBottom:16}}>{closeModal.setup.contract}</div>\n    <div style={{marginBottom:12}}>\n     <div style={{fontSize:9,color:T.textSec,marginBottom:4}}>Exit Premium ($)</div>\n     <input type="number" step="0.01" value={exitPrice} onChange={e=>setExitPrice(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:12,borderRadius:4,fontFamily:FD,width:"100%",boxSizing:"border-box"}} />\n     {exitPrice && entry && (\n      <div style={{fontSize:10,marginTop:4,color:isUp?T.sage:T.rose,fontFamily:FD}}>\n       {pct.toFixed(1)}% vs entry ${entry}\n      </div>\n     )}\n    </div>\n    <div style={{marginBottom:12}}>\n     <div style={{fontSize:9,color:T.textSec,marginBottom:4}}>Exit Reason</div>\n     <select value={exitReason} onChange={e=>setExitReason(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:11,borderRadius:4,width:"100%"}}>\n      <option value="TARGET_HIT">Target Hit</option>\n      <option value="STOP_HIT">Stop Hit</option>\n      <option value="MANUAL_EXIT">Manual Exit</option>\n      <option value="INVALIDATED">Invalidated</option>\n      <option value="EXPIRY">Expiry</option>\n     </select>\n    </div>\n    <div style={{marginBottom:16}}>\n     <div style={{fontSize:9,color:T.textSec,marginBottom:4}}>Notes</div>\n     <textarea value={exitNotes} onChange={e=>setExitNotes(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:10,borderRadius:4,width:"100%",minHeight:56,boxSizing:"border-box"}} />\n    </div>\n    <div style={{display:"flex",gap:8}}>\n     <button onClick={onClose} style={{flex:1,padding:"9px",border:"1px solid "+T.border2,background:"transparent",color:T.textSec,borderRadius:4,cursor:"pointer"}}>Cancel</button>\n     <button onClick={onSubmit} disabled={!exitPrice} style={{flex:2,padding:"9px",border:"1px solid "+(exitPrice?T.sage:T.border2),background:exitPrice?T.sage+"22":"transparent",color:exitPrice?T.sage:T.textDim,borderRadius:4,cursor:exitPrice?"pointer":"not-allowed"}}>✓ Close Trade</button>\n    </div>\n   </div>\n  </div>\n );\n}\n\nexport default function OptionsScanner() {'
PATCHES.append((OLD9, NEW9, "CloseTradeModal component"))

for old, new, label in PATCHES:
    count = src.count(old)
    if count == 0:
        print(f"FAIL ({label}): anchor not found")
        sys.exit(1)
    if count > 1:
        print(f"WARN ({label}): {count} occurrences — replacing first only")
    src = src.replace(old, new, 1)
    print(f"OK: {label}")

open(PATH, "w", encoding="utf-8").write(src)
print(f"\nDone. New line count: {len(src.splitlines())}")
