#!/usr/bin/env python3
"""
patch_screener_change3.py
Applies Change 3 only: replaces screener IIFE with upgraded version
(sort/filter controls, rich cards, retracement bar, 5-segment score bar,
auto-generated signal line, memory context).

Run AFTER patch_screener_upgrade.py succeeds for Changes 1 & 2.
"""

import sys, re

PATH = "/Users/nick/option-flow-scanner/src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────
# OLD_SCREENER: extract directly from file to avoid anchor drift
# ─────────────────────────────────────────────────────────────────
START_ANCHOR = ' {view==="screener"&&(()=>{'
END_ANCHOR = ' })()}'

start_idx = src.find(START_ANCHOR)
if start_idx == -1:
    print("✗ FAILED: screener IIFE start not found")
    sys.exit(1)

end_idx = src.find(END_ANCHOR, start_idx)
if end_idx == -1:
    print("✗ FAILED: screener IIFE end not found")
    sys.exit(1)

end_idx += len(END_ANCHOR)  # include the closing marker
OLD_SCREENER = src[start_idx:end_idx]
print(f"✓ Located screener IIFE ({len(OLD_SCREENER)} chars, ends at char {end_idx})")

# ─────────────────────────────────────────────────────────────────
# NEW_SCREENER: upgraded version with sort/filter + rich cards
# ─────────────────────────────────────────────────────────────────
NEW_SCREENER = """ {view==="screener"&&(()=>{
  const setupSymbols=new Set(SETUPS.map(s=>s.symbol));
  const condKeys=["topdown_bias","expansion","in_zone","vol_confirm","liquid"];
  const condLabels={"topdown_bias":"Top-Down Bias","expansion":"Expansion","in_zone":"0\u201350% Zone","vol_confirm":"Vol Confirm","liquid":"Liquid"};
  const doReload=()=>{setScreenerLoading(true);fetch("./data/stocks.json?_="+Date.now()).then(r=>r.json()).then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);}).catch(()=>setScreenerLoading(false));};
  const biasColor=b=>b==="BULL"?T.green:T.rose;
  const selS={fontSize:9,padding:"2px 6px",background:T.bg,border:"1px solid "+T.border,color:T.textSec,borderRadius:3,fontFamily:FM,cursor:"pointer"};

  // Sort + bias filter
  const allFiltered=screenerHits.filter(h=>scrBias==="all"||h.bias===scrBias);
  const sorted=[...allFiltered].sort((a,b)=>{
    if(scrSort==="score") return b.met-a.met;
    if(scrSort==="retr") return parseFloat(b.details?.retr_pct||0)-parseFloat(a.details?.retr_pct||0);
    return a.ticker.localeCompare(b.ticker);
  });
  const newHits=sorted.filter(h=>!setupSymbols.has(h.ticker));
  const trackedHits=sorted.filter(h=>setupSymbols.has(h.ticker));

  // Memory context for a ticker
  const memCtx=(ticker)=>{
    try{
      const mem=JSON.parse(localStorage.getItem("of_memory")||"[]");
      return mem.filter(m=>m.symbol===ticker).slice(-2);
    }catch{return [];}
  };

  // Signal line
  const signalLine=(h)=>{
    const retr=parseFloat(h.details?.retr_pct||0);
    const dir=h.bias==="BULL"?"Watching for C2 bullish entry":"Watching for C2 bearish entry";
    const zoneNote=retr<=50?"inside 0\u201350% zone":"outside zone \u2014 wait";
    return `${dir}. Retr ${retr.toFixed(1)}% ${zoneNote}.`;
  };

  // Rich card renderer
  const renderCard=(h)=>{
    const mem=memCtx(h.ticker);
    const retrPct=parseFloat(h.details?.retr_pct||0);
    const retrBarW=Math.min(retrPct,100);
    const retrColor=retrPct<=50?T.sage:T.rose;
    return(
      <div key={h.ticker} style={{borderBottom:"1px solid "+T.border,padding:"12px 14px"}}>
        {/* Row 1: ticker + bias + score */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div>
            <span style={{fontSize:14,fontWeight:700,color:T.textPri,fontFamily:FM}}>{h.ticker}</span>
            <span style={{fontSize:10,color:T.textDim,fontFamily:FD,marginLeft:6}}>${h.price?.toFixed(2)}</span>
          </div>
          <div style={{background:biasColor(h.bias)+"22",color:biasColor(h.bias),fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:3,border:"1px solid "+biasColor(h.bias)+"44",letterSpacing:"0.08em"}}>{h.bias==="BULL"?"▲ CALL":"▼ PUT"}</div>
          <div style={{marginLeft:"auto",display:"flex",gap:2,alignItems:"center"}}>
            {condKeys.map(k=>(
              <div key={k} title={condLabels[k]} style={{width:8,height:8,borderRadius:2,background:h.conditions?.[k]?T.sage:T.border2}}/>
            ))}
            <span style={{fontSize:10,fontWeight:700,color:h.met===5?T.sage:h.met>=4?T.gold:T.textDim,marginLeft:5,fontFamily:FM}}>{h.met}/5</span>
          </div>
        </div>
        {/* Row 2: retracement bar */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>Retracement</span>
            <span style={{fontSize:8,color:retrColor,fontFamily:FD,fontWeight:retrPct<=50?700:400}}>{retrPct.toFixed(1)}%{retrPct<=50?" \u2713":""}</span>
          </div>
          <div style={{height:4,borderRadius:2,background:T.border2,overflow:"hidden"}}>
            <div style={{height:"100%",width:retrBarW+"%",background:retrColor,borderRadius:2}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:1}}>
            <span style={{fontSize:7,color:T.textDim,fontFamily:FD}}>0%</span>
            <span style={{fontSize:7,color:T.sage,fontFamily:FD}}>50%</span>
            <span style={{fontSize:7,color:T.textDim,fontFamily:FD}}>100%</span>
          </div>
        </div>
        {/* Row 3: signal line */}
        <div style={{fontSize:9,color:T.textSec,fontFamily:FD,marginBottom:mem.length?5:0,fontStyle:"italic"}}>{signalLine(h)}</div>
        {/* Row 4: memory context */}
        {mem.length>0&&(
          <div style={{fontSize:8,color:T.textDim,fontFamily:FD,borderTop:"1px solid "+T.border+"44",paddingTop:4,marginTop:4}}>
            {mem.map((m,i)=><div key={i}>📌 {new Date(m.ts).toLocaleDateString()}: {m.note}</div>)}
          </div>
        )}
        {setupSymbols.has(h.ticker)&&<div style={{fontSize:8,color:T.gold,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:4}}>★ In Scanner</div>}
      </div>
    );
  };

  return(
    <div style={{padding:16}}>
      {screenerLoading&&<div style={{textAlign:"center",padding:32,color:T.textDim,fontSize:12,fontFamily:FM}}>Loading screener data...</div>}
      {!screenerLoading&&screenerHits.length===0&&(
        <div style={{textAlign:"center",padding:32,color:T.textDim}}>
          <div style={{fontSize:12,fontFamily:FM}}>No screener data found</div>
          <div style={{fontSize:10,color:T.border2,marginTop:4,fontFamily:FD}}>Trigger CI workflow manually from GitHub Actions</div>
          <button onClick={doReload} style={{marginTop:12,fontSize:9,padding:"5px 14px",background:T.surface,border:"1px solid "+T.border,color:T.textSec,borderRadius:4,cursor:"pointer",fontFamily:FM}}>Retry</button>
        </div>
      )}
      {!screenerLoading&&screenerHits.length>0&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.textPri,fontFamily:FM,letterSpacing:"0.05em"}}>📡 SCREENER HITS</div>
              <div style={{fontSize:9,color:T.textDim,fontFamily:FD,marginTop:3}}>
                {screenerMeta.universe_size} stocks / {allFiltered.length} shown / {screenerMeta.generated_at?new Date(screenerMeta.generated_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):""}
              </div>
            </div>
            <button onClick={doReload} style={{fontSize:9,padding:"4px 10px",background:T.surface,border:"1px solid "+T.border,color:T.textSec,borderRadius:4,cursor:"pointer",fontFamily:FM,flexShrink:0}}>Refresh</button>
          </div>
          {/* Sort + bias controls */}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:12,padding:"8px 10px",background:T.surface,border:"1px solid "+T.border,borderRadius:5}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:FM}}>Sort</span>
              <select value={scrSort} onChange={e=>setScrSort(e.target.value)} style={selS}>
                <option value="score">Score \u2193</option>
                <option value="retr">Retracement %</option>
                <option value="ticker">Ticker A\u2013Z</option>
              </select>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:FM}}>Bias</span>
              <select value={scrBias} onChange={e=>setScrBias(e.target.value)} style={selS}>
                <option value="all">All</option>
                <option value="BULL">Calls \u25b2</option>
                <option value="BEAR">Puts \u25bc</option>
              </select>
            </div>
            <span style={{fontSize:8,color:T.textDim,fontFamily:FD,marginLeft:"auto"}}>{allFiltered.length} shown</span>
          </div>
          {newHits.length>0&&(
            <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:6,overflow:"hidden",marginBottom:10}}>
              <div style={{padding:"8px 14px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:6,background:T.bg}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:T.sage,flexShrink:0}}/>
                <span style={{fontSize:9,fontWeight:700,color:T.sage,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FM}}>New Candidates</span>
                <span style={{fontSize:9,color:T.textDim,marginLeft:"auto"}}>{newHits.length} not yet in scanner</span>
              </div>
              {newHits.map(renderCard)}
            </div>
          )}
          {trackedHits.length>0&&(
            <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:6,overflow:"hidden",marginBottom:10}}>
              <div style={{padding:"8px 14px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:6,background:T.bg}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:T.gold,flexShrink:0}}/>
                <span style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FM}}>Already Tracked</span>
                <span style={{fontSize:9,color:T.textDim,marginLeft:"auto"}}>Screener confirms open setups</span>
              </div>
              {trackedHits.map(renderCard)}
            </div>
          )}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6,padding:"8px 0",borderTop:"1px solid "+T.border,alignItems:"center"}}>
            <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>Conditions:</span>
            {condKeys.map(k=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:3}}>
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

# ─────────────────────────────────────────────────────────────────
# Apply
# ─────────────────────────────────────────────────────────────────
if OLD_SCREENER not in src:
    print("✗ FAILED: OLD_SCREENER not found after extraction (unexpected)")
    sys.exit(1)

src = src.replace(OLD_SCREENER, NEW_SCREENER, 1)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("✓ Change 3 applied: screener upgraded with rich cards, sort/filter, signal line, memory context")
print("Next: git add src/App.jsx && git commit -m 'Screener upgrade: rich cards + sort/filter' && npm run deploy")
