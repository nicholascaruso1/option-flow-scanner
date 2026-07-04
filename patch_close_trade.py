#!/usr/bin/env python3
"""
patch_close_trade.py
Rebuilds Close Trade modal + Closed tab.
Adds: closeModal state, 4 form state vars, openCloseModal helper,
      Close button on active cards (pl section),
      Closed tab content (summary + score/phase breakdown + trade list),
      modal overlay JSX.
"""

PATH = "/Users/nick/option-flow-scanner/src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

errors = []

# ─────────────────────────────────────────────────────────────────
# CHANGE 1 — Add state vars after openScreenerRows
# ─────────────────────────────────────────────────────────────────
OLD_STATE = ' const [openScreenerRows, setOpenScreenerRows] = useState({});'
NEW_STATE = (
 ' const [openScreenerRows, setOpenScreenerRows] = useState({});\n'
 ' const [closeModal, setCloseModal] = useState(null);\n'
 ' const [closeExitPrice, setCloseExitPrice] = useState("");\n'
 ' const [closePnlPct, setClosePnlPct] = useState("");\n'
 ' const [closeExitReason, setCloseExitReason] = useState("TARGET_HIT");'
)
if OLD_STATE in src:
    src = src.replace(OLD_STATE, NEW_STATE, 1)
    print("\u2713 Change 1: state vars added")
else:
    errors.append("\u2717 Change 1 FAILED: openScreenerRows anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 2 — Add openCloseModal helper before return(
# ─────────────────────────────────────────────────────────────────
OLD_RETURN = ' const NUMS=["\\u2460","\\u2461","\\u2462"];'
NEW_RETURN = (
 ' const openCloseModal=(s)=>{\n'
 '  const hit=screenerHits.find(h=>h.ticker===s.symbol);\n'
 '  setCloseModal({ticker:s.symbol,entryPhase:s.phase,score:hit?.met??null});\n'
 '  setCloseExitPrice(""); setClosePnlPct(""); setCloseExitReason("TARGET_HIT");\n'
 ' };\n'
 ' const NUMS=["\\u2460","\\u2461","\\u2462"];'
)
if OLD_RETURN in src:
    src = src.replace(OLD_RETURN, NEW_RETURN, 1)
    print("\u2713 Change 2: openCloseModal helper added")
else:
    errors.append("\u2717 Change 2 FAILED: NUMS anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 3 — Add Close Trade button to active card pl section
# ─────────────────────────────────────────────────────────────────
OLD_PL_END = (
 '     <span style={{fontSize:9,color:T.textDim}}>Intrinsic ${pl.intrinsic.toFixed(2)}</span>\n'
 '     </div>\n'
 '     )}'
)
NEW_PL_END = (
 '     <span style={{fontSize:9,color:T.textDim}}>Intrinsic ${pl.intrinsic.toFixed(2)}</span>\n'
 '     <button onClick={()=>openCloseModal(s)} style={{marginLeft:"auto",padding:"4px 10px",background:T.rose+"18",border:"1px solid "+T.rose+"50",borderRadius:3,color:T.rose,fontSize:9,cursor:"pointer",fontFamily:FM,flexShrink:0}}>Close Trade</button>\n'
 '     </div>\n'
 '     )}'
)
if OLD_PL_END in src:
    src = src.replace(OLD_PL_END, NEW_PL_END, 1)
    print("\u2713 Change 3: Close Trade button added to active cards")
else:
    errors.append("\u2717 Change 3 FAILED: pl section end anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 4 — Add Closed tab content before methodology block
# ─────────────────────────────────────────────────────────────────
OLD_METH = ' {(view==="all"||view==="managing"||view==="everything")&&('
NEW_METH = (
 ' {view==="closed"&&(\n'
 '  <div style={{padding:"16px 20px"}}>\n'
 '  {closedTrades.length===0?(\n'
 '   <div style={{textAlign:"center",padding:"60px 20px"}}>\n'
 '    <div style={{fontSize:32,color:T.border2,marginBottom:10}}>\u2713</div>\n'
 '    <div style={{fontSize:13,color:T.textSec}}>No closed trades yet</div>\n'
 '    <div style={{fontSize:10,color:T.textDim,marginTop:4}}>Close a trade from an active position to record it here</div>\n'
 '   </div>\n'
 '  ):(()=>{\n'
 '   const wins=closedTrades.filter(t=>t.pnlPct>0).length;\n'
 '   const wr=Math.round((wins/closedTrades.length)*100);\n'
 '   const avgPnl=(closedTrades.reduce((a,t)=>a+(t.pnlPct||0),0)/closedTrades.length).toFixed(1);\n'
 '   const by5=closedTrades.filter(t=>t.score===5);\n'
 '   const by4=closedTrades.filter(t=>t.score===4);\n'
 '   const wr5=by5.length?Math.round((by5.filter(t=>t.pnlPct>0).length/by5.length)*100):null;\n'
 '   const wr4=by4.length?Math.round((by4.filter(t=>t.pnlPct>0).length/by4.length)*100):null;\n'
 '   const phases=[...new Set(closedTrades.map(t=>t.entryPhase).filter(Boolean))];\n'
 '   return(<>\n'
 '    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>\n'
 '     {[["Win Rate",wr+"%",wr>=50?T.sage:T.rose],["Avg PnL",avgPnl+"%",parseFloat(avgPnl)>=0?T.sage:T.rose],["Trades",closedTrades.length,T.textPri]].map(([l,v,c])=>(\n'
 '      <div key={l} style={{flex:1,minWidth:80,background:T.surface,border:"1px solid "+T.border,borderRadius:5,padding:"10px 12px",textAlign:"center"}}>\n'
 '       <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{l}</div>\n'
 '       <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:FD}}>{v}</div>\n'
 '      </div>\n'
 '     ))}\n'
 '    </div>\n'
 '    {(wr5!==null||wr4!==null)&&(\n'
 '     <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:5,padding:"10px 12px",marginBottom:12}}>\n'
 '      <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Win Rate by Screener Score</div>\n'
 '      {wr5!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:10,color:T.textSec}}>5/5 setups</span><span style={{fontSize:10,fontWeight:600,color:wr5>=50?T.sage:T.rose,fontFamily:FD}}>{wr5}% ({by5.length} trades)</span></div>}\n'
 '      {wr4!==null&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:T.textSec}}>4/5 setups</span><span style={{fontSize:10,fontWeight:600,color:wr4>=50?T.sage:T.rose,fontFamily:FD}}>{wr4}% ({by4.length} trades)</span></div>}\n'
 '     </div>\n'
 '    )}\n'
 '    {phases.length>0&&(\n'
 '     <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:5,padding:"10px 12px",marginBottom:12}}>\n'
 '      <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Win Rate by Entry Phase</div>\n'
 '      {phases.map(ph=>{\n'
 '       const pts=closedTrades.filter(t=>t.entryPhase===ph);\n'
 '       const phWr=Math.round((pts.filter(t=>t.pnlPct>0).length/pts.length)*100);\n'
 '       return(<div key={ph} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:10,color:PHASES[ph]?.color||T.textDim}}>{ph}</span><span style={{fontSize:10,fontWeight:600,color:phWr>=50?T.sage:T.rose,fontFamily:FD}}>{phWr}% ({pts.length})</span></div>);\n'
 '      })}\n'
 '     </div>\n'
 '    )}\n'
 '    <div style={{display:"flex",flexDirection:"column",gap:6}}>\n'
 '     {[...closedTrades].reverse().map((t,i)=>(\n'
 '      <div key={i} style={{background:T.surface,border:"1px solid "+T.border,borderRadius:5,padding:"10px 12px",borderLeft:"3px solid "+(t.pnlPct>0?T.sage:T.rose)}}>\n'
 '       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>\n'
 '        <div style={{display:"flex",gap:8,alignItems:"center"}}>\n'
 '         <span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:T.textPri}}>{t.ticker}</span>\n'
 '         {t.entryPhase&&<span style={{fontSize:8,color:PHASES[t.entryPhase]?.color||T.textDim,textTransform:"uppercase"}}>{t.entryPhase}</span>}\n'
 '         {t.score&&<span style={{fontSize:8,color:T.gold}}>{t.score}/5 \u2605</span>}\n'
 '        </div>\n'
 '        <span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:t.pnlPct>0?T.sage:T.rose}}>{t.pnlPct>0?"+":""}{(t.pnlPct||0).toFixed(1)}%</span>\n'
 '       </div>\n'
 '       <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>\n'
 '        <span style={{fontSize:9,color:T.textDim}}>Exit ${t.exitPrice}</span>\n'
 '        <span style={{fontSize:9,color:T.textDim}}>{t.exitReason?.replace(/_/g," ")}</span>\n'
 '        <span style={{fontSize:9,color:T.textDim}}>{t.exitDate}</span>\n'
 '       </div>\n'
 '      </div>\n'
 '     ))}\n'
 '    </div>\n'
 '   </>);\n'
 '  })()}\n'
 '  </div>\n'
 ' )}\n'
 ' {(view==="all"||view==="managing"||view==="everything")&&('
)
if OLD_METH in src:
    src = src.replace(OLD_METH, NEW_METH, 1)
    print("\u2713 Change 4: Closed tab content added")
else:
    errors.append("\u2717 Change 4 FAILED: methodology anchor not found")

# ─────────────────────────────────────────────────────────────────
# CHANGE 5 — Add modal overlay before <style> tag
# ─────────────────────────────────────────────────────────────────
OLD_STYLE = ' <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>'
NEW_STYLE = (
 ' {closeModal&&(\n'
 '  <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setCloseModal(null)}>\n'
 '   <div style={{background:T.surface,border:"1px solid "+T.border2,borderRadius:8,padding:20,width:"100%",maxWidth:360,boxShadow:"0 16px 48px #00000066"}} onClick={e=>e.stopPropagation()}>\n'
 '    <div style={{fontSize:13,fontWeight:700,color:T.textPri,marginBottom:4}}>Close Trade \u00b7 {closeModal.ticker}</div>\n'
 '    <div style={{fontSize:9,color:T.textDim,marginBottom:16}}>Entry phase: {closeModal.entryPhase}{closeModal.score?" \u00b7 Score: "+closeModal.score+"/5":""}</div>\n'
 '    <div style={{marginBottom:10}}>\n'
 '     <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Exit Price</div>\n'
 '     <input type="number" placeholder="0.00" value={closeExitPrice} onChange={e=>setCloseExitPrice(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:11,borderRadius:4,fontFamily:FM,outline:"none",width:"100%",boxSizing:"border-box"}}/>\n'
 '    </div>\n'
 '    <div style={{marginBottom:10}}>\n'
 '     <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>PnL %</div>\n'
 '     <input type="number" placeholder="+12.5 or -8.2" value={closePnlPct} onChange={e=>setClosePnlPct(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:11,borderRadius:4,fontFamily:FM,outline:"none",width:"100%",boxSizing:"border-box"}}/>\n'
 '    </div>\n'
 '    <div style={{marginBottom:16}}>\n'
 '     <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Exit Reason</div>\n'
 '     <select value={closeExitReason} onChange={e=>setCloseExitReason(e.target.value)} style={{background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:11,borderRadius:4,fontFamily:FM,outline:"none",width:"100%",boxSizing:"border-box"}}>\n'
 '      {["TARGET_HIT","STOPPED_OUT","MANUAL_EXIT","MOMENTUM_FADE","NEWS_EVENT","END_OF_DAY"].map(r=>(<option key={r} value={r}>{r.replace(/_/g," ")}</option>))}\n'
 '     </select>\n'
 '    </div>\n'
 '    <div style={{display:"flex",gap:8}}>\n'
 '     <button onClick={()=>setCloseModal(null)} style={{flex:1,padding:"9px",background:"transparent",border:"1px solid "+T.border,borderRadius:4,color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:FM}}>Cancel</button>\n'
 '     <button onClick={()=>{\n'
 '      if(!closeExitPrice||!closePnlPct)return;\n'
 '      const trade={ticker:closeModal.ticker,exitPrice:parseFloat(closeExitPrice),pnlPct:parseFloat(closePnlPct),exitReason:closeExitReason,exitDate:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),closedAt:Date.now(),entryPhase:closeModal.entryPhase,score:closeModal.score};\n'
 '      const updated=[...closedTrades,trade];\n'
 '      setClosedTrades(updated);\n'
 '      ss("of_closed_trades",updated);\n'
 '      setCloseModal(null);\n'
 '     }} style={{flex:2,padding:"9px",background:T.sage+"22",border:"1px solid "+T.sage+"60",borderRadius:4,color:T.sage,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FM}}>Record Trade</button>\n'
 '    </div>\n'
 '   </div>\n'
 '  </div>\n'
 ' )}\n'
 ' <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>'
)
if OLD_STYLE in src:
    src = src.replace(OLD_STYLE, NEW_STYLE, 1)
    print("\u2713 Change 5: Close Trade modal added")
else:
    errors.append("\u2717 Change 5 FAILED: style tag anchor not found")

# ─────────────────────────────────────────────────────────────────
# Write or report
# ─────────────────────────────────────────────────────────────────
if errors:
    print("\nERRORS — file NOT saved:")
    for e in errors: print(" ", e)
else:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src)
    print("\n\u2713 All changes applied. File saved.")
    print("Next: cp src/App.jsx ~/Downloads/options-scanner.jsx && git add . && git commit -m 'closed tab: modal + ledger + entryPhase' && git push && npm run deploy")
