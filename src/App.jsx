import { useState, useEffect, useCallback, useRef } from "react";
const T = {
 bg:"#080E1C", surface:"#0F1B2E", border:"#1A2C45", border2:"#243850",
 textPri:"#E8EEF8", textSec:"#7A92B0", textDim:"#3A5270",
 gold:"#C9A84C", goldDim:"#6B5520", blue:"#4A90D9", rose:"#C0445A",
 sage:"#3D8B6E", green:"#3DBF7A", amber:"#B87333", slate:"#5A7A9A", teal:"#2A8B7A", purple:"#8B5CF6",
};
const FM = "-apple-system,Segoe UI,sans-serif";
const FD = "SF Mono,Fira Code,monospace";
async function ls(key,fb){try{const r=localStorage.getItem(key);return r?JSON.parse(r):fb;}catch{return fb;}}
async function ss(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}
function daysUntil(d){return Math.max(0,Math.ceil((new Date(d+"T16:00:00")-new Date())/86400000));}
function getSessionProfile() {
 const now = new Date();
 const utc = now.getTime() + now.getTimezoneOffset()*60000;
 const est = new Date(utc + (-5*3600000));
 const h = est.getHours() + est.getMinutes()/60;
 if (h>=18||h<1) return {profile:"18:00 Reversal Watch",session:"Asia",color:"#4A90D9",actionable:false,
 note:"Asia session (18:00–01:00 EST). Watch for Asia to set the intraday high/low. If Asia sets it and London expands away — 18:00 Reversal profile confirmed. NY continues in that direction."};
 if (h>=1&&h<8) return {profile:"01:00 Reversal Watch",session:"London",color:"#B87333",actionable:false,
 note:"London session (01:00–08:00 EST). If Asia consolidated and London is now reversing to set the high/low — 01:00 Reversal profile. NY continues. If Asia + London captured full range, pass the day."};
 if (h>=8&&h<9.5) return {profile:"08:00 — Pre-Market",session:"Pre-Market",color:"#C9A84C",actionable:false,
 note:"Pre-market (08:00–09:30 EST). If neither Asia nor London set the reversal, NY must form it at the open via a manipulation. Watch 9:30 open closely."};
 if (h>=9.5&&h<16) return {profile:"New York Session Active",session:"New York",color:"#3D8B6E",actionable:true,
 note:"NY session (09:30–16:00 EST). Only valid entry window. 9:30 open either supports continuation or creates intraday reversal via manipulation. NY closes in direction of daily candle 86% of time."};
 return {profile:"After Hours",session:"Closed",color:"#3A5270",actionable:false,
 note:"Market closed. Plan for tomorrow: identify relevant swings on daily, set primary and secondary scenarios for each session profile."};
}
function getWeeklyProfile() {
 const now = new Date();
 const utc = now.getTime() + now.getTimezoneOffset()*60000;
 const est = new Date(utc + (-5*3600000));
 const day = est.getDay(); 
 const profiles = [
 {day:0,name:"Weekend",color:"#3A5270",desc:"Market closed. Plan: identify weekly high/low structure, set bias for Monday open."},
 {day:1,name:"Classic Expansion — Day 1",color:"#4A90D9",desc:"Classic Expansion: Mon/Tue forms weekly high/low. C2 closure confirms extreme. 1H CISD confirms. Wednesday = primary expansion entry (highest probability). Thursday = second. Step aside after 2-3 expansion days."},
 {day:2,name:"Classic Expansion — C2 or Midweek Watch",color:"#B87333",desc:"Classic Expansion: if Tue forms weekly high/low, C2 closure confirms, Wed/Thu expand. If Tue reverses Mon strongly = Midweek Reversal developing. Wednesday = confirmation day either way."},
 {day:3,name:"Wednesday — Primary Expansion Day",color:"#C9A84C",desc:"Wednesday = highest probability expansion entry in Classic Expansion. Seek & Destroy possible (both sides raided first). Consolidation Reversal breakout also triggers Wed."},
 {day:4,name:"Thursday — Second Expansion or Counter",color:"#8B5CF6",desc:"Thursday = second expansion opportunity (lower probability). Thursday Counter: counter-trend move trapping Wed traders. After 2-3 expansion days, step aside."},
 {day:5,name:"TGIF Setup",color:"#C0445A",desc:"Friday reversal against the weekly trend. TGIF traps late-week breakout traders. If price has been trending all week, a Friday reversal is the setup. Reduce size — Friday closes can be manipulated into the weekend."},
 {day:6,name:"Weekend",color:"#3A5270",desc:"Market closed. Review the week's profile. Did Classic Expansion, Midweek Reversal, or another profile materialize? Use this to calibrate next week's bias."},
 ];
 return profiles[day] || profiles[0];
}

const MEMORY_MAX_DAYS = 14;

function todayKey() {
 const now = new Date();
 const utc = now.getTime() + now.getTimezoneOffset()*60000;
 const est = new Date(utc + (-5*3600000));
 return est.toISOString().slice(0,10);
}

function parseInvalidation(invalidationStr) {
 if (!invalidationStr) return null;
 if (/inside range/i.test(invalidationStr)) return null;
 const thresholds = [];
 const re = /(below|above)\s+\$?([\d,]+(?:\.\d+)?)/gi;
 let m;
 while ((m = re.exec(invalidationStr)) !== null) {
 const direction = m[1].toLowerCase();
 const price = parseFloat(m[2].replace(/,/g,""));
 if (!isNaN(price)) thresholds.push({direction, price});
 }
 return thresholds.length ? thresholds : null;
}

function checkInvalidation(setup, price) {
 const thresholds = parseInvalidation(setup.invalidation);
 if (!thresholds || price==null) return {breached:false, thresholds:null};
 for (const t of thresholds) {
 if (t.direction==="below" && price < t.price) return {breached:true, threshold:t};
 if (t.direction==="above" && price > t.price) return {breached:true, threshold:t};
 }
 return {breached:false, thresholds};
}

function computeMarketState(setup, invalidationCheck) {
 if (invalidationCheck.breached) return "INVALIDATED";
 if (setup.isActive) return "IN_TRADE";
 if (setup.phase && setup.phase!=="CONSOLIDATION") return "ACTIVE_SETUP";
 return "WATCHING";
}

function buildMemorySnapshot(setup, liveQuote, aiUpdate) {
 const phase = (aiUpdate&&aiUpdate.phase) || setup.phase;
 const price = (liveQuote&&liveQuote.price) || setup.price;
 const chg = (liveQuote&&liveQuote.chg!=null) ? liveQuote.chg : (setup.chg||null);
 let keyLevelStatus = "unknown";
 if (setup.keyLevels && price) {
 for (const lvl of setup.keyLevels) {
 const lp = parseFloat(String(lvl.p||"").replace(/[$,]/g,""));
 if (!lp) continue;
 const pct = Math.abs((price-lp)/lp);
 if (pct < 0.01) { keyLevelStatus = "at_level:"+lvl.l; break; }
 }
 }
 const invCheck = checkInvalidation(setup, price);
 const state = computeMarketState(setup, invCheck);
 return {
 date: todayKey(),
 phase,
 direction: setup.direction || setup.dir || null,
 price,
 chg,
 keyLevelStatus,
 state,
 invalidated: invCheck.breached,
 invalidatedAt: invCheck.breached ? invCheck.threshold.price : null,
 };
}

function computeStreak(history, field) {
 if (!history || history.length===0) return {value:null,days:0};
 const latest = history[history.length-1];
 const val = latest[field];
 let days = 1;
 for (let i=history.length-2;i>=0;i--) {
 if (history[i][field]===val) days++;
 else break;
 }
 return {value:val,days};
}

function getMemoryNarrative(history) {
 if (!history || history.length<2) return null;
 const phaseStreak = computeStreak(history, "phase");
 const dirStreak = computeStreak(history, "direction");
 const parts = [];
 if (phaseStreak.days>=2) {
 parts.push(`${phaseStreak.days}${ordinalSuffix(phaseStreak.days)} consecutive session in ${phaseStreak.value} phase`);
 }
 if (dirStreak.days>=3 && dirStreak.value) {
 parts.push(`${dirStreak.value} bias held for ${dirStreak.days} sessions`);
 }
 const last = history[history.length-1];
 const prev = history[history.length-2];
 if (prev && last.phase!==prev.phase) {
 parts.push(`Phase shifted ${prev.phase} → ${last.phase} since last session`);
 }
 if (prev && last.keyLevelStatus!=="unknown" && last.keyLevelStatus!==prev.keyLevelStatus) {
 parts.push(`Now testing: ${last.keyLevelStatus.replace("at_level:","")}`);
 }
 if (prev && last.state!==prev.state) {
 parts.push(`State changed ${prev.state} → ${last.state}`);
 }
 return parts.length ? parts.join(". ")+"." : null;
}

// Returns the active invalidation alert for the most recent snapshot, or null.
function getInvalidationAlert(history) {
 if (!history || history.length===0) return null;
 const last = history[history.length-1];
 if (!last.invalidated) return null;
 return `Invalidation level breached at $${last.invalidatedAt}. Current price $${last.price}.`;
}

function ordinalSuffix(n) {
 if (n%10===1&&n%100!==11) return "st";
 if (n%10===2&&n%100!==12) return "nd";
 if (n%10===3&&n%100!==13) return "rd";
 return "th";
}

function pnlCalc(ep,price,strike,dir){
 if(!ep||!price)return null;
 const intrinsic=dir==="call"?Math.max(0,price-strike):Math.max(0,strike-price);
 const est=Math.max(intrinsic,ep*0.05);
 return{est,pct:((est-ep)/ep)*100,intrinsic};
}
const PHASES={
 EXPANSION:{label:"Exp.",icon:"↑",color:T.blue},
 CONSOLIDATION:{label:"Consolidating",icon:"—",color:T.gold},
 RETRACEMENT:{label:"Retracing",icon:"↩",color:T.amber},
 READY:{label:"Ready to Enter",icon:"◉",color:T.sage},
 MANAGING:{label:"Managing",icon:"●",color:T.teal},
 WATCH_REVERSAL:{label:"Watch Reversal",icon:"⚠",color:T.rose},
};

function PhasePipeline({phase}){
 const stages=[
  {key:"EXP",tip:"C2 expansion occurred"},
  {key:"C2",tip:"Retracing — looking for failure swing"},
  {key:"READY",tip:"C3 CISD confirmed — entry window"},
  {key:"LIVE",tip:"Position active"},
 ];
 const idx={EXPANSION:0,CONSOLIDATION:0,RETRACEMENT:1,WATCH_REVERSAL:1,READY:2,MANAGING:3};
 const cur=idx[phase]??0;
 const inv=phase==="WATCH_REVERSAL";
 return(
  <div style={{display:"flex",alignItems:"center",gap:0}}>
   {stages.map((st,i)=>{
    const done=i<cur,active=i===cur;
    const col=inv&&active?T.rose:active?T.gold:done?T.sage:T.border2;
    return(<span key={st.key} title={st.tip} style={{display:"flex",alignItems:"center"}}>
     <span style={{
      display:"inline-block",width:active?8:6,height:active?8:6,
      borderRadius:"50%",background:done?T.sage:active?T.gold:T.border2,
      border:active?"1.5px solid "+col:"none",
      boxShadow:active?"0 0 4px "+col+"60":"none",
      flexShrink:0,transition:"all 0.18s ease",
     }}/>
     {i<stages.length-1&&<span style={{
      display:"inline-block",width:10,height:1,
      background:i<cur?T.sage+"50":T.border,margin:"0 2px",
     }}/>}
    </span>);
   })}
   <span style={{fontSize:8,color:inv?T.rose:T.textDim,fontFamily:FM,marginLeft:5,letterSpacing:"0.06em"}}>
    {inv?"WATCH":stages[cur]?.key||""}
   </span>
  </div>
 );
}
const CAP_COLORS={Mega:T.blue,Large:T.sage,Mid:T.amber,Small:T.gold,Micro:T.purple};
const CHECKLIST=[
 {id:"swing", label:"C2 closure confirmed (failure swing)", desc:"C2 = middle candle making the extreme. C2 body closing through the level is the entry trigger. C1 = prior direction candle. Wick-only does not count."},
 {id:"cisd", label:"C3 CISD body close confirmed", desc:"CISD = price closes through the series of candles that CREATED the move into the level. After C2 closure, drop to lower TF — must see CISD there or setup is invalid. Missing CISD = skip the trade even if C2 looks clean on the higher TF."},
 {id:"range", label:"Not in a range (no failure swings both sides)",desc:"If failure swings exist on BOTH sides with no confirmed reaction, price is ranging. Do not trade inside. Wait for price to reach the external boundary."},
 {id:"ob", label:"Order Block identified + Mean Threshold", desc:"OB = series of last opposite-color candles before expansion. Anchor Fib from OB body. Mark Mean Threshold = 50% of OB body (Fib 0.5 body low to body high). OB valid while price holds above/below the mean threshold. OB invalidated only if price CLOSES beyond the mean threshold — not just touches it."},
 {id:"fib50", label:"Price inside 0–50% Fib zone", desc:"Retracement held above (call) or below (put) the 50% Fib level, anchored from the Order Block."},
 {id:"iv", label:"IV Rank below 30", desc:"Buying premium — don't overpay. Check Market Chameleon."},
 {id:"dte", label:"DTE 21+ days minimum", desc:"Farthest affordable expiry. Avoid <21 DTE on entry."},
 {id:"budget", label:"Within account budget (5%)", desc:"IRA ≤$200 · Individual ≤$5 per contract."},
 {id:"oi", label:"OI > 500 on target strike", desc:"Confirms liquidity. Check bid/ask spread < 10% of mid."},
 {id:"topdown", label:"Top-down bias aligned", desc:"Monthly/weekly direction confirms daily setup direction."},
];
const SETUPS=[
 {symbol:"ABCL",company:"AbCellera Biologics",price:7.60,chg:-1.17,vol:"8.0M",mcap:"$2.03B",capSize:"Small",
 direction:"call",phase:"MANAGING",tier:"Tier 1",isActive:true,
 contract:"$5 Call · Jul 17 · Both",entryPremium:0.27,strike:5,expiryDate:"2026-07-17",
 earningsDate:"2026-08-06",earningsLabel:"Aug 6",accountFit:["IRA ($200)","Individual ($3-5)"],
 autoChecks:["close","fib50","dte","budget","topdown"],retailTrap:true,
 narrative:"🔴 Bearish — clinical losses (-$146M). Retail skeptical. C1 = downtrend from $11→$2.75.",
 structure:"🟢 Bullish — 52-wk high at $7.39 on record volume. C2 closed through $6.86 OB. C3 CISD confirmed. Weekly fractal expansion.",
 divergence:"AMD: Accumulation $2.75–$5 base. Manipulation = $6.66 AH dip trapping bears. Distribution = expansion toward $8.84–$11. Retail selling into record-volume weekly candle.",
 phaseNote:"MANAGING — Protected swing = $6.66 OB. Monday 4pm BODY close ABOVE $6.66 = hold IRA. Body close BELOW $6.66 = exit. Wick through $6.66 does NOT invalidate per TTrades.",
 entryNote:"$5 call intrinsic ~$1.66 at $6.66. Monitor Monday open. If holds above $6.66 with C3 CISD body close, IRA continues. Body close below $6.66 = exit IRA same day.",
 nestedFib:"OB: $6.86 (last down-close before Jun 27 expansion). Anchor Fib from OB body high to swing low. Mean Threshold = 50% of OB body. -1 extension = next target.",
 invalidation:"Daily body close below $6.66 (Order Block / protected swing violated)",
 logEntry:{ts:"Jul 1, 2026",note:"$7.60 close Jul 1, holding above $6.66 OB/protected swing. IRA position active. ABCL635 Phase 2 data expected Q3 2026 = primary catalyst. Earnings Aug 6. Body close below $6.66 = exit signal."},
 keyLevels:[{p:"$7.44",l:"52-wk high / swing high watch",c:T.gold},{p:"$7.39",l:"Prior close",c:T.teal},{p:"$6.86",l:"OB / Fib anchor · Mean Threshold $6.76",c:T.gold},{p:"$6.66",l:"Order Block / Protected Swing — body close below = exit IRA",c:T.rose},{p:"$5.00",l:"Strike",c:T.textDim}],
 catalysts:["Record volume 52-wk high close","ABCL635 Phase 2 data Q3 2026","Jazz Pharma TCE partnership","Cantor Fitz OW + $7 PT","EPS beat · Revenue 2x YoY","⚠ Earnings Aug 6 — after expiry, consider rolling"],
 mtf:[["12M","bull","Basing"],["6M","bull","Exp."],["3M","bull","Momentum"],["Monthly","bull","Breakout"],["Weekly","bull","Fractal exp."],["Daily","bull","Above levels"]],
 },
 {symbol:"ATAI",company:"AtaiBeckley Inc.",price:4.88,chg:-6.24,vol:"8.2M",mcap:"$1.94B",capSize:"Small",
 direction:"call",phase:"MANAGING",tier:"Tier 1",isActive:true,
 contract:"Call · Jul 17 · IRA",entryPremium:0.27,strike:3,expiryDate:"2026-07-17",
 earningsDate:"2026-08-12",earningsLabel:"Aug 12",accountFit:["IRA ($200)"],
 autoChecks:["close","fib50","dte","budget","topdown"],retailTrap:true,
 narrative:"🔴 Bearish — psychedelic biotech, $660M losses. C1 = downtrend from $20+→$2.15. Retail skeptical.",
 structure:"🟢 Bullish — +15.94% today on 63M volume. C2 closed through $4.30 OB. C3 CISD confirmed. Russell add tomorrow.",
 divergence:"Classic AMD: Accumulation $3.78–$4.30 (3 weeks). Manipulation = Jun 23 wick below $3.78 trapping shorts. Distribution = +15.94% expansion. Retail bearish = exit liquidity.",
 phaseNote:"MANAGING — IRA riding. Watch retrace to $4.68–$5.00 Mon/Tue. New C2 at $4.00 OB + C3 body close up = leg 2. Hold above $4.00.",
 entryNote:"No new entries. If retrace to $4.00–$4.30 holds and C2/C3 develops, confirms next leg. Protected swing = $3.78 (C2 low). Body close below $3.78 = full invalidation.",
 nestedFib:"OB: ~$4.00 (last down-close before Jun 22 expansion). Anchor nested Fib from $5.31 to swing low on retrace. Mean Threshold = 50% of OB body. -1 = next target.",
 invalidation:"Daily body close below $3.78 (protected swing / OB violated)",
 logEntry:{ts:"Jul 1, 2026",note:"$4.88 Jul 1 — retracing from $5.36 peak. Russell add completed Jun 29. Watch $4.00–$4.30 OB zone for C2 failure swing. Body close below $3.78 = exit IRA."},
 keyLevels:[{p:"$6.75",l:"52-wk high / macro target",c:T.sage},{p:"$5.31",l:"Current / expansion close",c:T.teal},{p:"$4.30",l:"Prior OB / support",c:T.gold},{p:"$4.00",l:"OB range floor · Mean Threshold ~$4.08",c:T.gold},{p:"$3.78",l:"Protected Swing / C2 low — body close below = full invalidation",c:T.rose}],
 catalysts:["Russell 2000 + 3000 add Jun 29","BPL-003 Phase 3 · VLS-01 Phase 2b Q4","White House EO tailwind","Q1 EPS beat · Rev 4x · $209.9M runway","⚠ Earnings Aug 12 — after expiry, consider rolling"],
 mtf:[["12M","bear","Down"],["6M","neut","Basing"],["3M","bull","Recov."],["Monthly","bull","Breakout"],["Weekly","bull","Conf."],["Daily","bull","Above levels"]],
 },
 {symbol:"SMCI",company:"Super Micro Computer",price:27.65,chg:-9.19,vol:"52.0M",mcap:"$20.5B",capSize:"Large",
 direction:"call",phase:"WATCH_REVERSAL",tier:"Tier 1",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:"2026-08-11",earningsLabel:"Aug 11",accountFit:["IRA ($200)"],
 autoChecks:["budget"],retailTrap:true,
 narrative:"🔴 Bearish — class action lawsuits, AI oversupply, cash flow. NEW: Taiwan offices raided Jun 29 (Nvidia chip smuggling allegations). C1 = bearish leg $51→$27.",
 structure:"🔴 Bearish — Prior call setup INVALIDATED. $27.65 is a body close below $29.38 protected swing. Taiwan raid catalyst Jun 29 = new bearish C2 forming. Watch for dead-cat bounce to $29-$31 Bearish OB before put entry.",
 divergence:"AMD: Accumulation below $27. Manipulation = $27.13 wick Jun 15 stopping out retail shorts. Distribution = Jun 22 expansion + pending C3 confirmation. Retail still selling = your call entry liquidity.",
 phaseNote:"WATCH REVERSAL — Call setup INVALIDATED at $29.38 (body close below = violated). Taiwan office raids Jun 29 created a new bearish catalyst. Watch for bounce to $29–$31 (prior OB). If C2 failure swing forms and C3 CISD body close below = put entry thesis begins. Earnings Aug 11 = risk event.",
 entryNote:"Entry: 4pm BODY close above $31.64 OB. Anchor nested Fib $43.80→C2 low. Mean Threshold of OB = $30.51. -1 = first target. Protected swing = C2 body low. Delta 0.35–0.45, Aug/Sep DTE.",
 nestedFib:"OB = $31.64 (last resistance before expansion). Mean Threshold = $30.51. Fib from $43.80 to C2 low. -1 ext = first target. Protected swing = C2 wick low — body close below = exit.",
 invalidation:"Daily body close below $29.38 (OB / protected swing violated — wick through does NOT count)",
 logEntry:{ts:"Jul 1, 2026",note:"INVALIDATED — $27.65 body close below $29.38 protected swing. Taiwan offices raided Jun 29 (alleged Nvidia chip smuggling) — new bearish catalyst. Prior call thesis canceled. Watch for dead-cat bounce to $29-$31 OB for potential put setup."},
 keyLevels:[{p:"$56.00",l:"-2 ext (weekly target)",c:T.sage},{p:"$43.80",l:"-1 ext / first target",c:T.sage},{p:"$31.64",l:"Bullish OB / C2 trigger · Mean Threshold $30.51",c:T.gold},{p:"$30.59",l:"Current — in 0–50% zone",c:T.teal},{p:"$29.38",l:"50% Fib / Protected Swing — body close below = invalidation",c:T.rose}],
 catalysts:["Earnings Aug 11","GF Securities Buy @ $48 PT","Nvidia Vera Rubin partnership Jun 22","36% EPS beat"],
 mtf:[["12M","bear","Decline"],["6M","bear","Down"],["3M","neut","Basing"],["Monthly","bull","Reclaim"],["Weekly","bull","Exp."],["Daily","bull","Entry zone"]],
 },
 {symbol:"SPCX",company:"Space Exploration Tech",price:157.54,chg:2.94,vol:"65.4M",mcap:"$2.0T",capSize:"Mega",
 direction:"put",phase:"RETRACEMENT",tier:"Tier 1",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:"2026-08-06",earningsLabel:"Aug 6",accountFit:["IRA ($200)"],
 autoChecks:["topdown","budget"],retailTrap:true,
 narrative:"🟢 Bullish — SpaceX IPO hype, Nasdaq 100 add Jul 7, Elon brand. Max FOMO. C1 = IPO hype candle $135→$225.64 ATH.",
 structure:"🔴 Bearish — ATH $225.64 is the C1 high. Bearish leg $225.64→$147.11 = C2 expansion. Now retracing to Bearish OB at $173.14.",
 divergence:"AMD reverse: Short accumulation at $173–$181 OB. Manipulation = Nasdaq add Jul 7 spikes INTO OB, trapping retail longs. Distribution = put expansion from $173 toward $147+.",
 phaseNote:"RETRACEMENT — Bouncing from $147 toward Bearish OB $173.14. C2 at $173–$181.58, C3 body close below = put entry. Nasdaq add Jul 7 may fuel spike into OB.",
 entryNote:"Wait for bounce to $173–$181.58 (Bearish OB). C2 wick above $173, C3 body close below = put entry. Protected swing = C2 wick high. Body close above $181.58 = invalidation.",
 nestedFib:"Bearish OB = $173.14. Mean Threshold = $168 (50% of OB body). Fib from $225.64 ATH to C2 low for extensions. -1 = first put target.",
 invalidation:"Daily body close above $181.58 (Bearish OB / 50% Fib violated — wick through ≠ invalidation)",
 logEntry:{ts:"Jun 28, 2026",note:"Bearish expansion from ATH $225.64 reclaimed. Bouncing from ATL $147.11. Nasdaq 100 add Jul 7 may spike into $173–$18..."},
 keyLevels:[{p:"$181.58",l:"0.5 Fib / invalidation",c:T.rose},{p:"$173.14",l:"Bearish OB — C3 body close below = put entry · Mean Threshold $168",c:T.gold},{p:"$153.23",l:"Current — retracing up",c:T.teal},{p:"$139.39",l:"-2 ext target",c:T.sage},{p:"$105.00",l:"-4 macro target",c:T.sage}],
 catalysts:["Nasdaq 100 add Jul 7 — bounce fuel INTO resistance","Earnings Aug 6","$4.9B net loss · Post-IPO distribution"],
 mtf:[["12M","n/a","No history"],["6M","n/a","No history"],["3M","bear","From ATH"],["Monthly","bear","H&S complete"],["Weekly","bear","Cont."],["Daily","bear","Ret. to OB"]],
 },
 {symbol:"MLYS",company:"Mineralys Therapeutics",price:23.76,chg:-17.64,vol:"3.9M",mcap:"$1.96B",capSize:"Small",
 direction:"put",phase:"EXPANSION",tier:"Tier 2",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:null,earningsLabel:null,accountFit:["IRA ($200)"],
 autoChecks:["budget"],retailTrap:true,
 narrative:"🟢 Bullish (retail) — biotech seen as oversold after -17.64%. C1 = prior uptrend into Jun 26 catalyst.",
 structure:"🔴 Bearish — Jun 26 -17.64% IS the C2 expansion through prior base. Bearish OB = last up-close before drop (~$28.50 open).",
 divergence:"AMD: Institutional short accumulation above $28.50. Manipulation = initial catalyst spike trapping longs. Distribution = -17.64% C2. Retail dip-buyers = exit liquidity. Wait for dead-cat bounce to fade.",
 phaseNote:"EXPANSION — C2 occurred. Waiting for bounce to Bearish OB ($26.13–$28.50). C2 wick above OB, C3 body close below = put entry.",
 entryNote:"Wait for bounce to $26–$28.50 (Bearish OB). C2 failure swing: wick above OB, C3 CISD body close back below = put entry. Protected swing = C2 bounce wick high. OI must be > 500.",
 nestedFib:"Bearish OB = $28.50. Mean Threshold = $26.13 (50% of OB body). Fib $28.50→$23.76. After entry, nest Fib from C2 bounce high for extension targets.",
 invalidation:"Daily body close above $28.50 (Bearish OB reclaimed = thesis invalidated)",
 logEntry:{ts:"Jun 28, 2026",note:"-17.64% expansion Jun 26. Bearish OB ceiling at ~$28.50. Waiting 1-3 days for dead-cat bounce. Need C2 failure swing ..."},
 keyLevels:[{p:"$28.50",l:"Bearish OB / range ceiling · Mean Threshold $26.13",c:T.gold},{p:"$26.13",l:"50% Fib / OB Mean Threshold — invalidation on bounce",c:T.rose},{p:"$23.76",l:"Current / C2 expansion low",c:T.teal},{p:"$18–$20",l:"-1 extension target",c:T.sage}],
 catalysts:["Clinical/regulatory catalyst Jun 26 — verify","Biotech sector pressure"],
 mtf:[["12M","bear","Down"],["6M","bear","Cont."],["3M","neut","Prior cons."],["Monthly","neut","Neutral"],["Weekly","bear","Level break"],["Daily","bear","-17.64% exp."]],
 },
 {symbol:"ILLR",company:"Triller Group Inc",price:4.46,chg:46.0,vol:"Low",mcap:"$13.6M",capSize:"Micro",
 direction:"watch",phase:"EXPANSION",tier:"Tier 2",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:null,earningsLabel:null,accountFit:["Individual ($3-5)","IRA ($200)"],
 autoChecks:[],retailTrap:true,
 narrative:"🟢 Bullish (retail) — SpaceX-linked treasury + Elon FOMO. C1 undefined — pre-spike sub-$0.25 (reverse split). Momentum/news event.",
 structure:"⚪ Undefined — Jun 26 +46% IS the C2 expansion. OB = $3.05 (open of that candle). Body close above $3.05 = OB as support, call setup. Body close below $3.05 = Bearish OB forms, put setup.",
 divergence:"AMD in watch mode: Accumulation unclear. Manipulation = announcement spike trapping momentum buyers at $4.46. Distribution direction = undecided until $3.05 confirmed or violated on a daily body close.",
 phaseNote:"EXPANSION — C2 occurred Jun 26. $3.05 OB = direction decider. CALL: retrace to $3.75, C2, C3 close up = entry. PUT: body close below $3.05 → retrace → C2 → C3 close down = entry.",
 entryNote:"No entry yet. Both scenarios: C2 failure swing + C3 CISD body close. CALL: body close above $3.75. PUT: body close below $3.05 first. Protected swing = $3.05 OB. OI must be > 300.",
 nestedFib:"CALL: Fib from $3.05 OB to C2 low. PUT: Fib from $4.46 high to C2 bounce high. Extensions = targets.",
 invalidation:"CALL: body close below $3.05. PUT: body close above $4.50.",
 logEntry:{ts:"Jun 30, 2026",note:"⚠ Nasdaq compliance deadline TODAY. Price $4.46 vs $1 minimum requirement — well above threshold. Watch today's 4pm close. $4.46 is now the OB/direction decider. C2/C3 setup still developing."},
 keyLevels:[{p:"$4.46",l:"C2 expansion high",c:T.teal},{p:"$3.75",l:"50% Fib (call hold zone)",c:T.gold},{p:"$3.05",l:"OB / direction decider — body close above or below",c:T.rose}],
 catalysts:["$411M SpaceX-linked treasury","57M volume — 15x average","⚠ Nasdaq compliance deadline Jun 30"],
 mtf:[["12M","n/a","No history"],["6M","n/a","No history"],["3M","n/a","No history"],["Monthly","n/a","No history"],["Weekly","n/a","Micro only"],["Daily","neut","$3.05 key"]],
 },
 // ── PFE — Screener candidate Jul 2 2026 ─────────────────────────
 {symbol:"PFE",company:"Pfizer Inc",price:24.30,chg:-0.96,vol:"49.3M",mcap:"$137B",capSize:"Large",
 direction:"put",phase:"RETRACEMENT",tier:"Tier 2",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:"2026-08-04",earningsLabel:"Aug 4",accountFit:["IRA ($200)"],
 autoChecks:["topdown","budget"],retailTrap:true,
 narrative:"🔴 Bearish — 55% off 2021 ATH ($61.25), COVID revenue collapse ongoing. All 3 SMAs bearish (price below 20/50/200). Jun 24 expansion candle = C2 bearish continuation. Price now in 31% retracement of that expansion leg.",
 structure:"🔴 Bearish — Multi-year downtrend. Jun 24 expansion confirmed by volume (49M vs 38M avg). Resistance cluster $25.50–$26.21 (multiple MAs converging). Screener confirmed 5/5 pre-conditions met Jul 2.",
 divergence:"Retail trap: 7.14% dividend yield attracting value buyers into a structural downtrend. Smart money (institutions) not accumulating — insider buys are phantom stock units (compensation), not open-market conviction. SigVie-002 Phase 3 MISSED Jun 22 = new bearish catalyst.",
 phaseNote:"RETRACEMENT — 31% into retracement of Jun 24 expansion leg. Resistance at $25.50–$26.21 (MA cluster). Need to see C2 failure swing form at or below resistance, then C3 body close through candles that created the Jun 24 move. Earnings Aug 4 = hard deadline for any position.",
 entryNote:"Wait for bounce into $25.50–$26.21 resistance zone (Bearish OB cluster). C2 wick above $26.21, C3 body close below $25.50 = put entry. Protected swing = C2 wick high. DTE minimum 45 days from entry to clear Aug 4 earnings. Budget: Sep/Oct expiry puts.",
 nestedFib:"C1 = ATH $61.25 to multi-year low. C2 expansion = Jun 24 bearish candle. -1 extension target ~$21–$22 range. Mean threshold of OB = $25.85.",
 invalidation:"Daily body close above $27.14 (above all key moving averages — uptrend reversal confirmed, put thesis invalid)",
 logEntry:{ts:"Jul 2, 2026",note:"Screener flagged 5/5 pre-conditions Jul 2. PFE $24.30 confirmed bearish: below all 3 SMAs, Jun 24 expansion with volume, currently 31% into retracement zone. SigVie-002 Phase 3 miss Jun 22 = fresh bearish catalyst. Earnings Aug 4. Watching for bounce to $25.50–$26.21 OB cluster."},
 keyLevels:[
  {p:"$27.14",l:"Above all MAs — invalidation",c:"#EF4444"},
  {p:"$26.21",l:"Resistance cluster top / OB upper bound",c:"#F59E0B"},
  {p:"$25.50",l:"Bearish OB zone / MA convergence — C3 body close below = entry",c:"#F59E0B"},
  {p:"$24.30",l:"Current price",c:"#14B8A6"},
  {p:"$23.67",l:"Jun 2026 recent low",c:"#64748B"},
  {p:"$21.25",l:"-1 Fib extension target",c:"#10B981"},
 ],
 catalysts:["SigVie-002 Phase 3 MISSED Jun 22 (lung cancer ADC) — fresh bearish catalyst","Earnings Aug 4 — EPS est $0.68 (vs $0.75 last quarter)","Vyndamax patent settled through 2031 — removes one bear thesis but not enough to reverse trend","China clinical trial scrutiny ongoing","Ex-dividend Jul 24 ($0.43) — short-term support floor, then fades"],
 mtf:[["12M","bear","Multi-year downtrend from ATH"],["6M","bear","Below all MAs"],["3M","bear","SigVie miss Jun 22"],["Monthly","bear","Lower highs"],["Weekly","bear","Resistance $25.50–$26.21"],["Daily","neut","Retracing 31% into OB zone"]],
 },
 // ── BEAM — Screener candidate Jul 2 2026 ─────────────────────────
 {symbol:"BEAM",company:"Beam Therapeutics",price:34.30,chg:-1.33,vol:"2.5M",mcap:"$3.5B",capSize:"Small",
 direction:"call",phase:"RETRACEMENT",tier:"Tier 2",isActive:false,contract:null,
 entryPremium:null,strike:null,expiryDate:null,
 earningsDate:"2026-08-11",earningsLabel:"Aug 11",accountFit:["IRA ($200)"],
 autoChecks:["topdown","budget"],retailTrap:true,
 narrative:"🟢 Bullish — Base editing biotech. $1.2B cash, $500M secured credit facility Feb 2026. BEAM-302 accelerated FDA approval path confirmed. Risto-cel BLA submission H2 2026. 14 Buy / 2 Hold / 0 Sell analyst consensus. Median PT $43.50 (+27% from current).",
 structure:"🟢 Bullish — Jun 23 expansion candle on bullish bias (price above 20/50/200 SMAs). Currently 39% into retracement of that expansion = inside the 0–50% entry zone. Screener confirmed 5/5 pre-conditions. ATH $138.52 (Jul 2021). Current price ~$34 represents 75% off ATH — classic biotech reset with pipeline recovery catalyst.",
 divergence:"Retail trap: massive analyst spread ($22–$80 PT range) creates confusion. Bears focus on $94M quarterly net loss. Bulls focus on $1.2B cash runway + BLA path. The divergence is the binary data risk — BEAM-302 accelerated approval in 2026 = major re-rating event. Options volume will expand significantly into any FDA announcement.",
 phaseNote:"RETRACEMENT — 39% into Jun 23 expansion leg. Sitting comfortably in 0–50% zone. Need C2 failure swing (a down candle that makes a new low vs recent structure), then C3 body close back up through candles that created the Jun 23 expansion. Drop to 4H after C2 to confirm CISD before entry. Earnings Aug 11.",
 entryNote:"Price in 0–50% zone now ($30–$37 range). C2 = next pullback candle that makes a swing low. C3 body close above = call entry. Look for entry in the $31–$34 OB zone. Protected swing = C2 wick low — body close below = invalidation. Budget: $200 IRA, target Aug/Sep DTE to clear earnings Aug 11. IV will expand into FDA catalysts — enter when IV rank below 30.",
 nestedFib:"Jun 23 expansion leg: approximate high ~$38, low ~$28. OB = last bearish candle before Jun 23 move. -1 extension target ~$44–$46 range. Median analyst PT $43.50 cross-references -1 extension.",
 invalidation:"Daily body close below $28.50 (below Jun 23 expansion origin — C2 structure violated, prior bullish candles reclaimed by bears)",
 logEntry:{ts:"Jul 2, 2026",note:"Screener flagged 5/5 pre-conditions Jul 2. BEAM $34.30, bullish SMA alignment, Jun 23 expansion, currently 39% in retracement zone. $1.2B cash confirmed Feb 2026. BEAM-302 accelerated approval path H2 2026 = primary catalyst. 14 Buy ratings, median PT $43.50. Watching for C2 pullback to $31–$34 OB zone then C3 body close = call entry."},
 keyLevels:[
  {p:"$48.00",l:"ATH retracement resistance zone",c:"#EF4444"},
  {p:"$43.50",l:"Analyst median PT / -1 Fib extension target",c:"#F59E0B"},
  {p:"$38.00",l:"Jun 23 expansion high — C3 breakout confirms",c:"#F59E0B"},
  {p:"$34.30",l:"Current price — inside 0–50% zone",c:"#14B8A6"},
  {p:"$31.00",l:"OB zone lower bound — C2 target / entry zone",c:"#10B981"},
  {p:"$28.50",l:"Jun 23 expansion origin — invalidation below",c:"#EF4444"},
 ],
 catalysts:["BEAM-302 FDA accelerated approval path H2 2026 — primary re-rating catalyst","Risto-cel BLA submission H2 2026 (sickle cell disease)","$1.2B cash + $500M credit facility — no dilution risk near term","14 Buy / 0 Sell analyst consensus — strong institutional support","Earnings Aug 11 — beat Q4 2025 by $3.34 EPS (massive beat)","Japan partnership announced Mar 2026 (milestone payments)"],
 mtf:[["12M","bull","Recovering from $13 ATL"],["6M","bull","Above 20/50/200 SMAs"],["3M","bull","BEAM-302 data positive"],["Monthly","bull","Higher lows forming"],["Weekly","bull","Jun 23 expansion"],["Daily","neut","Retracing 39% — in zone"]],
 },
];
const CRYPTO=[
 {symbol:"BTC",name:"Bitcoin",price:107250,chg:1.24,vol:"High",cap:"Mega",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🔴 Risk-off macro session Jun 27 — equities sold -1.7% to -2.4%. BTC tracking correlation. C1 = prior bullish expansion from $58k to $72k. Retail narrative still bullish (halving cycle).",
 structure:"🟡 Consolidating — BTC in range between $65k (range floor / Bearish OB) and $72k (range ceiling / Bullish OB). Neither boundary has produced a C3 CISD yet. Range Protocol active — do not trade inside.",
 divergence:"Per AM Trades Range Protocol: failure swings exist on BOTH sides. Do not trade internal price action. Wait for price to reach $72k (ceiling) or $65k (floor), watch for manipulation wick, then wait for C3 CISD body close through the boundary. That is the only valid entry.",
 phaseNote:"CONSOLIDATION (Range) — Range Protocol in effect. No internal setups. Two scenarios: CALL if $65k floor produces a C2 failure swing wick below then C3 body close above. PUT if $72k ceiling produces C2 wick above then C3 body close below. Macro session (9:30 NY open) = binary: continuation or manipulation reversal.",
 entryNote:"No entry inside the range. CALL trigger: C3 body close above $72k OB after wick manipulation. PUT trigger: C3 body close below $65k OB. Protected swing = the C2 wick extreme in both cases. Directional bias via BTC/ETH SMT divergence: if BTC breaks $65k but ETH holds, SMT signal = BTC move is manipulation.",
 invalidation:"Inside range — no trade. External boundary body close = entry trigger, not invalidation.",
 levels:[{p:"$80,000",l:"Resistance / prior ATH zone",c:"#3D8B6E"},{p:"$72,000",l:"Range ceiling — close above = bullish expansion",c:"#C9A84C"},{p:"$68,956",l:"Current",c:"#2A8B7A"},{p:"$65,000",l:"Range floor — close below = bearish expansion",c:"#C0445A"},{p:"$58,000",l:"Major support / 50% Fib",c:"#C0445A"}],
 cats:["Macro risk-off Jun 27 — equities -1.7% to -2.4%","Fed rate policy remains hawkish","Halving cycle tailwind (longer term)"],
 },
 {symbol:"ETH",name:"Ethereum",price:2589,chg:0.86,vol:"High",cap:"Large",phase:"RETRACEMENT",dir:"watch",
 narrative:"🔴 Selling with BTC — ETF flows negative, risk-off macro. C1 = prior bullish leg from $2,800 to $3,500. ETH underperforming BTC (SMT signal).",
 structure:"🟡 Retracing from $3,500 expansion high toward $3,000 support (50% Fib / Order Block area). No C3 CISD yet. If $3,000 holds and produces a C2 failure swing (wick below, body close above), call setup forms.",
 divergence:"SMT Divergence alert: if BTC recovers but ETH does not make equivalent new high = ETH is the weaker instrument = bearish signal per TTrades SMT. Conversely, if BTC breaks $65k and ETH holds $3,000 = ETH showing relative strength = long bias on ETH. Monitor both together.",
 phaseNote:"RETRACEMENT — Pulling back toward $3,000 Order Block (last major consolidation before expansion). C2 failure swing needs to form at $3,000: wick below $3,000, body close back above = C3 CISD = call entry. AMD context: if Asia/London create the low at $3,000 and NY continues upward = 18:00 or 01:00 reversal profile.",
 entryNote:"Watch $3,000 Order Block. C2 wick below $3,000 + C3 body close above = call entry. Protected swing = C2 wick low (wherever it forms). Do not enter on wick alone — body close required per CISD rule.",
 invalidation:"Daily body close below $2,800 (protected swing / Order Block violated)",
 levels:[{p:"$4,000",l:"Major resistance",c:"#3D8B6E"},{p:"$3,500",l:"Prior expansion high",c:"#C9A84C"},{p:"$3,241",l:"Current",c:"#2A8B7A"},{p:"$3,000",l:"Key support / watch zone",c:"#C0445A"},{p:"$2,800",l:"50% Fib / invalidation",c:"#C0445A"}],
 cats:["ETH ETF flows negative","Macro risk-off","Staking yield demand intact"],
 },
 {symbol:"SOL",name:"Solana",price:172,chg:2.38,vol:"High",cap:"Mid",phase:"EXPANSION",dir:"watch",
 narrative:"🔴 Leading to the downside today — larger % drop than BTC/ETH (SMT divergence bearish signal). C1 = prior bullish expansion from $140 to $185. Retail narrative:'ecosystem growth, DeFi demand'.",
 structure:"🔴 Bearish — today IS the C2 expansion candle (-4.2%). Bearish Order Block = last up-close candle before the drop (~$185 open). C2 body closed below prior support. Now waiting for dead-cat bounce (middle phase) toward the Bearish OB.",
 divergence:"SMT Divergence: SOL -4.2% vs BTC -2.94% and ETH -3.1% — SOL is the weakest correlated asset. Per TTrades SMT: enter the weakest instrument in the direction of the move. SOL is the put vehicle if entering the crypto complex short. AMD: Manipulation = the $185 spike high. Distribution = today's C2 expansion down.",
 phaseNote:"EXPANSION — C2 occurred. Waiting for middle phase (bounce). C3 will form at the Bearish OB ($178–$185 zone). Watch for: price bounces to $178–$185, forms C2 wick above $185, body close back below $178 = C3 CISD = put entry. Session context: Asia may set the bounce high, London may confirm direction, NY is the entry window.",
 entryNote:"Wait for bounce to $178–$185 (Bearish OB). C2 failure swing (wick above OB, body close below). C3 CISD body close below $178 = put entry. Protected swing = C2 bounce wick high. AMD: this bounce is the Manipulation phase — the retail dip buyers create the entry liquidity.",
 invalidation:"Daily body close above $185 (Bearish OB reclaimed — OB violated, thesis invalidated)",
 levels:[{p:"$185",l:"Today's candle open / range ceiling",c:"#C9A84C"},{p:"$168",l:"Current / expansion low",c:"#2A8B7A"},{p:"$150",l:"-1 extension target",c:"#3D8B6E"},{p:"$140",l:"Major support",c:"#3D8B6E"}],
 cats:["Risk-off macro selloff","Solana ecosystem growth narrative (retail bullish)"],
 },
 {symbol:"LTC",name:"Litecoin",price:97,chg:1.05,vol:"Mod",cap:"Small",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🟡 Neutral — tracking BTC with less volatility. Lower correlation to ecosystem narrative vs ETH/SOL. C1 = prior expansion from $80 to $110.",
 structure:"🟡 Consolidating between $80 (floor) and $110 (ceiling). Range Protocol active — both sides have failure swings with no confirmed C3 CISD. No internal setup.",
 divergence:"If LTC breaks range ceiling ($110) with a C3 CISD while BTC is still consolidating = LTC showing independent relative strength (bullish SMT signal). If LTC breaks floor ($80) while BTC holds = LTC is the weakest correlated crypto = put vehicle.",
 phaseNote:"CONSOLIDATION (Range) — Range Protocol: do not trade inside. Monitor for external boundary engagement. If $110 produces C2 wick above then C3 body close above = call entry. If $80 produces C2 wick below then C3 body close below = put entry.",
 entryNote:"No setup. Range Protocol active. Flag for external boundary engagement only.",
 invalidation:"Inside range — no trade. Body close through boundary = setup trigger.",
 levels:[{p:"$110",l:"Resistance",c:"#C9A84C"},{p:"$94",l:"Current",c:"#2A8B7A"},{p:"$80",l:"Support",c:"#C0445A"}],
 cats:["BTC correlation","Limited catalyst pipeline"],
 },
];
const COMMODITIES=[
 {symbol:"GLD",name:"Gold (GC/GLD)",price:373.63,chg:1.13,vol:"High",cap:"Mega",phase:"WATCH_REVERSAL",dir:"watch",
 narrative:"🟢 Bullish — safe haven demand, dollar weakness, geopolitical risk. C1 = the multi-month bullish expansion from $3,800 to $4,500 ATH. Retail and institutional narratives both bullish.",
 structure:"🔴 Watch Reversal — -3.85% today is a significant C2 candle against the prior bullish structure. Bearish Order Block = $4,200 (last major up-close before the recent ATH run). If today BODY closes below $4,200, Bearish OB is confirmed and a put setup begins forming.",
 divergence:"AMD watch: Potential short accumulation at ATH $4,500. -3.85% = possible Manipulation→Distribution (bearish AMD). Retail bullish (safe haven) = dip-buyers become put setup liquidity if price fails $4,377.",
 phaseNote:"WATCH REVERSAL — 4pm close decides. BULL: hold above $4,200 → C2 + C3 close up = continuation. BEAR: close below $4,200 → retrace → C3 close down = put entry.",
 entryNote:"Wait for 4pm body close. Bull: $4,200 holds → C2 + C3 close up = continuation. Bear: close below $4,200 → retrace → C2 high + C3 close down = put entry. Protected swing = today's low.",
 invalidation:"Bull case: body close below $4,200. Bear case: body close above $4,500 ATH.",
 levels:[{p:"$4,500",l:"Prior ATH / resistance",c:"#3D8B6E"},{p:"$4,377",l:"Current — key close watch",c:"#2A8B7A"},{p:"$4,200",l:"Prior expansion candle open — critical level",c:"#C9A84C"},{p:"$4,000",l:"Major psychological support",c:"#C0445A"}],
 cats:["Risk-off selloff Jun 27 — unexpected given safe haven status","Fed hawkish rate outlook","Dollar strengthening intraday"],
 },
 {symbol:"SLV",name:"Silver (SI/SLV)",price:33.18,chg:0.91,vol:"High",cap:"Large",phase:"EXPANSION",dir:"put",
 narrative:"🟢 Bullish (retail) — silver seen as undervalued vs gold. C1 = prior bullish expansion from $55 to $75. Retail narrative:'silver is cheap gold, industrial + monetary demand'.",
 structure:"🔴 Bearish — -6.22% today IS the C2 bearish expansion candle. Larger than gold's -3.85% (SMT divergence — silver is the weaker instrument). Bearish Order Block = last up-close candle before drop (~$72.50 open). C2 body closed below prior support.",
 divergence:"SMT Divergence: SLV -6.22% vs GLD -3.85% — silver underperforming gold = silver is the weaker instrument = per TTrades SMT, SLV is the put vehicle in the metals complex. AMD: today's selloff is the Distribution phase. Retail buying the dip = exit liquidity. Classic retail trap:'cheap gold' narrative into a confirmed bearish C2.",
 phaseNote:"EXPANSION — C2 occurred. Waiting for middle phase (dead-cat bounce) toward Bearish OB ($70–$73). C2 failure swing will form in that zone: bounce wick above $72.50, C3 CISD body close back below = put entry. Session context: Asia/London may produce the bounce, NY session confirms direction.",
 entryNote:"Wait for bounce to $70–$73 (Bearish OB zone). C2 failure swing: wick above OB, C3 CISD body close back below $70 = put entry. Protected swing = C2 bounce wick high. Do not enter on wick alone. AMD: the bounce is the Manipulation phase — retail dip buyers create your entry.",
 invalidation:"Daily body close above $73 (Bearish OB reclaimed = thesis invalidated)",
 levels:[{p:"$73",l:"Today's candle open / range ceiling",c:"#C9A84C"},{p:"$68.12",l:"Current / expansion low",c:"#2A8B7A"},{p:"$62",l:"-1 extension target",c:"#3D8B6E"},{p:"$58",l:"-1.5 extension",c:"#3D8B6E"}],
 cats:["-6.22% today — largest 1-day drop in months","Industrial demand concerns","Gold/silver ratio expanding"],
 },
 {symbol:"CPER",name:"Copper (HG/CPER)",price:4.52,chg:-2.1,vol:"Mod",cap:"Mid",phase:"RETRACEMENT",dir:"watch",
 narrative:"🟢 Bullish — China stimulus, green energy demand, electrification narrative. C1 = prior expansion from $3.80 to $4.72. Fundamental narrative and structure aligned.",
 structure:"🟡 Retracing — pulling back from $4.72 expansion high toward Bullish Order Block at $4.40 (last down-close candle before the prior expansion). 50% Fib of the expansion leg. If OB holds, this is the clean middle phase entry zone.",
 divergence:"Strong narrative + bullish structure = no divergence signal here. This is a CONTINUATION setup — narrative and structure agree. No retail trap. Watch for C2 failure swing at the $4.40 OB as confirmation before entering.",
 phaseNote:"RETRACEMENT — Pulling back into Bullish OB ($4.40). C2 wick below OB, C3 body close above $4.40 = call entry. Asia/London may form the C2 low, NY = entry candle.",
 entryNote:"C2 failure swing at $4.40 OB + C3 CISD body close above = call entry. Protected swing = C2 wick low. Anchor nested Fib from $4.72 (prior expansion OB) to C2 low. -1 extension = first target. Delta 0.35–0.45, DTE 21–35 on CPER options.",
 invalidation:"Daily body close below $4.30 (protected swing violated — not just a wick)",
 levels:[{p:"$5.00",l:"Resistance / prior high",c:"#3D8B6E"},{p:"$4.72",l:"Prior expansion origin",c:"#C9A84C"},{p:"$4.52",l:"Current",c:"#2A8B7A"},{p:"$4.40",l:"50% Fib / entry watch zone",c:"#C0445A"},{p:"$4.30",l:"Invalidation",c:"#C0445A"}],
 cats:["China infrastructure stimulus","EV and grid electrification demand","Supply constraints from mining"],
 },
 {symbol:"PPLT",name:"Platinum (PL/PPLT)",price:1142,chg:0.8,vol:"Low",cap:"Small",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🟡 Neutral — hydrogen economy narrative but limited near-term catalyst. No C1 expansion candle to anchor a setup from.",
 structure:"🟡 Consolidating between $1,050 (floor) and $1,200 (ceiling). Range Protocol active — failure swings on both sides, no C3 CISD at either boundary. No internal setup valid.",
 divergence:"No divergence. Range-bound with no catalyst asymmetry. PPLT vs PALL: palladium showing relative strength (SMT divergence — PALL +2.26% vs PPLT +0.8%). If platinum complex breaks out, PALL is the stronger instrument.",
 phaseNote:"CONSOLIDATION (Range) — Range Protocol applies. Do not trade inside. Watch $1,200 ceiling: C2 wick above + C3 body close above = call entry. Watch $1,050 floor: C2 wick below + C3 body close below = put entry. Neither has engaged yet.",
 entryNote:"No setup. Monitor for external boundary engagement. Body close through either boundary triggers setup framework.",
 invalidation:"Inside range — no trade. Boundary engagement required.",
 levels:[{p:"$1,200",l:"Range ceiling",c:"#C9A84C"},{p:"$1,142",l:"Current",c:"#2A8B7A"},{p:"$1,050",l:"Range floor / support",c:"#C0445A"}],
 cats:["Hydrogen fuel cell demand (long-term)","Auto sector weakness near term"],
 },
 {symbol:"PALL",name:"Palladium (PA/PALL)",price:1220,chg:2.26,vol:"Low",cap:"Small",phase:"RETRACEMENT",dir:"call",
 narrative:"🔴 Bearish — EV transition reducing catalytic converter demand, down 14% past month. C1 = the multi-month bearish expansion from $1,600 to $1,150 low. Retail positioned bearish, citing EV structural headwind.",
 structure:"🟢 Potential reversal — today +2.26% after hitting the $1,150 zone (potential C2 low / Bullish OB). This may be the C2 failure swing forming: today's wick below $1,150 + body closing back above = classic CISD signal. C3 confirmation needed — body close above today's open tomorrow.",
 divergence:"AMD reversal setup: prior Accumulation of bearish positions drove the 14% drop (Distribution phase down). Manipulation = today's wick below $1,150 (stops out late shorts). If C3 body close above today's open occurs tomorrow = Distribution phase begins to the upside. Retail still bearish (EV narrative) = their short covering = your call fuel.",
 phaseNote:"C2 may be completing today at $1,150. C3 trigger: tomorrow body-closes above $1,200 = call entry. Seek & Destroy risk: London retests the low. Verify OI > 200 and spread before entry.",
 entryNote:"C3 CISD trigger: tomorrow's 4pm body close above $1,200 (today's open area) = call entry. Protected swing = today's C2 wick low ($1,150). Nested Fib: anchor from $1,600 prior OB to $1,150 C2 low. -1 extension = first target. ⚠ Thin options chain — verify OI > 200 and spread < 15% of mid before entering.",
 invalidation:"Daily body close below $1,150 (C2 low violated — protected swing broken)",
 levels:[{p:"$1,450",l:"-1 extension target",c:"#3D8B6E"},{p:"$1,350",l:"Prior cons.",c:"#C9A84C"},{p:"$1,220",l:"Current — potential swing low",c:"#2A8B7A"},{p:"$1,150",l:"Invalidation",c:"#C0445A"}],
 cats:["Down 14% past month — oversold on structure","EV transition reducing auto demand (bearish narrative)","Russia/SA supply dynamics"],
 },
 {symbol:"USO",name:"WTI Crude (CL/USO)",price:77.42,chg:-0.62,vol:"High",cap:"Large",phase:"EXPANSION",dir:"call",
 narrative:"🔴 Bearish (retail) — recession fears, demand destruction, oversupply narrative. C1 = prior bearish leg from $97 to $85 (multi-week downtrend). Retail short crude citing macro weakness.",
 structure:"🟢 Bullish — +3.84% today IS the C2 expansion candle through prior resistance. Bullish Order Block = last down-close candle before today's expansion (~$90.30 open). Today's body close above $91 confirmed the bullish C2. Waiting for middle phase pullback into the OB.",
 divergence:"AMD: Accumulation between $85–$90 (base building, 3 weeks). Manipulation = the brief dip below $87 last week (stopped out weak longs). Distribution = today's +3.84% C2 expansion. Retail is still short/bearish (recession narrative) = their short covering fuels the continuation. Classic retail trap on the upside.",
 phaseNote:"EXPANSION — C2 occurred today. Waiting for middle phase (pullback). Bullish OB = $90.30 (today's candle open). Pullback to $90–$91 = the 0–50% Fib zone. C2 failure swing forms there: wick below OB, C3 CISD body close back above $91 = call entry. Session profile: Asia/London pullback creates C2, NY continuation = entry window.",
 entryNote:"Wait for pullback to $90–$91 (Bullish OB zone). C2 failure swing: wick below OB, C3 CISD body close above $91 = call entry. Protected swing = C2 wick low. Anchor nested Fib from $97 prior OB to today's C2 open ($90.30). -1 extension = first target (~$100). Delta 0.35–0.45 on USO options.",
 invalidation:"Daily body close below $89 (protected swing / Bullish OB violated — wick through does NOT count)",
 levels:[{p:"$100",l:"-1 extension target",c:"#3D8B6E"},{p:"$93.79",l:"Current / expansion high",c:"#2A8B7A"},{p:"$90.30",l:"Today's open / range floor",c:"#C9A84C"},{p:"$89",l:"50% Fib / invalidation",c:"#C0445A"},{p:"$85",l:"Major support",c:"#C0445A"}],
 cats:["+3.84% today on OPEC+ compliance","Middle East supply risk premium","Recession demand fears (retail bearish)"],
 },
 {symbol:"UNG",name:"Natural Gas (NG/UNG)",price:3.31,chg:-1.2,vol:"Mod",cap:"Mid",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🟡 Neutral — storage builds near seasonal average. No strong catalyst. C1 is ambiguous — price has been range-bound for 6+ weeks with no clear directional expansion.",
 structure:"🟡 Consolidating — Range Protocol active. $3.10 = range floor (Bullish OB). $3.60 = range ceiling (Bearish OB). Both boundaries have failure swings. No C3 CISD at either boundary. Do not trade inside.",
 phaseNote:"CONSOLIDATION (Range) — Range Protocol: do not trade inside. Watch $3.60 ceiling: C2 wick above + C3 body close above = call entry. Watch $3.10 floor: C2 wick below + C3 body close below = put entry. Summer cooling demand could trigger $3.60 ceiling engagement.",
 entryNote:"No setup. Range Protocol active. Flag $3.60 as the call trigger and $3.10 as the put trigger. Body close through either boundary = framework setup begins.",
 invalidation:"Inside range — no trade. Boundary body close = entry trigger, not invalidation.",
 levels:[{p:"$3.60",l:"Range ceiling",c:"#C9A84C"},{p:"$3.31",l:"Current",c:"#2A8B7A"},{p:"$3.10",l:"Range floor",c:"#C0445A"}],
 cats:["Summer cooling demand","LNG export capacity","Storage near seasonal avg"],
 divergence:"No divergence. Monitor only.",
 },
];
const INDICES=[
 {symbol:"SPY",name:"S&P 500 ETF",price:751.00,chg:0.85,vol:"Very High",cap:"Mega",phase:"WATCH_REVERSAL",dir:"put",
 narrative:"🟢 Bullish (consensus) — soft landing, AI earnings, Fed pivot narrative. C1 = the prior expansion from $618 to $668 ATH. Retail and institutional consensus is bullish.",
 structure:"🔴 Watch Reversal — -1.74% today after parabolic ATH run. Potential C2 expansion beginning. Bearish Order Block = $651 (today's open / prior expansion candle origin). If today's body closes below $651, C2 bearish expansion is confirmed.",
 divergence:"AMD watch: Accumulation of institutional shorts may be occurring at ATH. Manipulation = today's gap down open trapping retail bulls. Distribution = potential continuation lower. Key: if retail buys this dip (consensus bullish) and price fails to recover $651, those buyers are the exit liquidity for smart money shorts. SMT: SPY vs QQQ — QQQ down -2.38% vs SPY -1.74% = QQQ is the weaker instrument = QQQ puts are the primary vehicle per TTrades SMT.",
 phaseNote:"WATCH REVERSAL — 4pm close decides. BULL: holds above $651 OB → C3 body close up = continuation. BEAR: body close below $651 → retrace → C2 high + C3 close down = put entry. Check weekly profile: Classic Expansion or Midweek Reversal developing?",
 entryNote:"Bear trigger: close below $651 → retrace → C2 failure swing → C3 CISD body close down = put entry. Protected swing = C2 bounce wick high. Delta 0.35–0.45, DTE 21-35.",
 invalidation:"Bull case: body close back above $651. Bear case: body close above $668 ATH.",
 levels:[{p:"$668",l:"Prior ATH",c:"#3D8B6E"},{p:"$651",l:"Today's open / watch level",c:"#C9A84C"},{p:"$647.72",l:"Current",c:"#2A8B7A"},{p:"$632",l:"50% Fib of recent expansion",c:"#C0445A"},{p:"$618",l:"Major support",c:"#C0445A"}],
 cats:["Nasdaq -2.38% led decline","Semiconductor weakness","Small/microcaps outperforming large caps (rotation signal)","Fed rate policy hawkish"],
 },
 {symbol:"QQQ",name:"Nasdaq 100 ETF",price:736.40,chg:1.73,vol:"Very High",cap:"Mega",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🟢 Bullish — AI capex supercycle, Mag 7 earnings, tech dominance. C1 = prior expansion from $505 to $558 ATH. Maximum bullish narrative at the highs.",
 structure:"🔴 Bearish C2 expansion today — -2.38%, largest index decline. Bearish Order Block = $553 (today's candle open). C2 body closing below $540 confirms bearish expansion underway.",
 divergence:"SMT: QQQ -2.38% vs SPY -1.74% = QQQ is the weaker instrument = primary put vehicle. AMD: Short accumulation at $558 ATH. Manipulation = ATH spike. Distribution = C2 expansion. Retail AI dip buyers = exit liquidity.",
 phaseNote:"CONSOLIDATION — Prior put thesis from June lows fully invalidated. QQQ rallied from $505 lows all the way to $736+. Now watch for range boundaries to form. Major recovery in progress — wait for new structure before re-entering any directional setup.",
 entryNote:"Wait for bounce to $550–$555 (Bearish OB). C2 failure swing: wick above, C3 CISD body close below $550 = put entry. Protected swing = C2 bounce wick high. Anchor Fib from $558 ATH to today's low for extension targets. Delta 0.35–0.45, DTE 21–35.",
 invalidation:"Daily body close above $558 (Bearish OB / ATH violated — not just a wick)",
 levels:[{p:"$558",l:"Today's open / range ceiling",c:"#C9A84C"},{p:"$540.18",l:"Current / expansion low",c:"#2A8B7A"},{p:"$520",l:"-1 extension target",c:"#3D8B6E"},{p:"$505",l:"-1.5 extension",c:"#3D8B6E"}],
 cats:["Mag 7 repricing / AI capex concerns","Semiconductor sector -3%+","Short-term bearish | Long-term bullish (TradingView community)"],
 },
 {symbol:"DIA",name:"Dow Jones ETF",price:439.89,chg:-0.31,vol:"High",cap:"Mega",phase:"CONSOLIDATION",dir:"watch",
 narrative:"🟢 Bullish — value, blue chip earnings, defensive rotation. C1 = prior expansion from $440 to $480 high. DIA holds the strongest relative structure of the four index ETFs today.",
 structure:"🟡 Consolidating — smallest decline of the four indices (-1.01% vs QQQ -2.38%). DIA showing relative strength (SMT divergence vs QQQ/SPY). No C2 expansion candle yet. Watching for direction after tech selloff resolves.",
 divergence:"SMT Divergence (bullish for DIA): QQQ -2.38%, SPY -1.74%, IWM -1.70%, DIA -1.01%. DIA is the STRONGEST correlated index. Per TTrades SMT: if entering index calls, DIA is the primary vehicle (strongest relative performance). Defensive rotation from tech into value/Dow names is structural, not just a 1-day event.",
 phaseNote:"CONSOLIDATION — No expansion yet. Watch: if QQQ falls but DIA holds $459 = SMT divergence = DIA call setup. C2 at $450 OB + C3 body close above = call entry.",
 entryNote:"No confirmed setup. Monitor for C2 failure swing at $450 (Bullish OB) if price pulls back. C3 CISD body close above $450 = call entry. Alternatively: if QQQ puts confirm, fade DIA for calls as the relative strength vehicle. Protected swing = $450.",
 invalidation:"Daily body close below $450 (Bullish OB / protected swing violated)",
 levels:[{p:"$480",l:"Resistance / prior high",c:"#C9A84C"},{p:"$459.60",l:"Current",c:"#2A8B7A"},{p:"$450",l:"Support / 50% Fib",c:"#C0445A"}],
 cats:["Defensive rotation into Dow names","Underperforming Nasdaq YTD — catching up","Value vs growth rotation"],
 },
 {symbol:"IWM",name:"Russell 2000 ETF",price:211.73,chg:0.44,vol:"High",cap:"Large",phase:"READY",dir:"call",
 narrative:"🔴 Bearish (narrative) — small caps underperform in risk-off, higher rates hurt balance sheets. C1 = years of underperformance vs large caps. Retail consensus: avoid IWM in high-rate environment.",
 structure:"🟢 Bullish (structure) — IWM showing relative strength vs QQQ today (-1.70% vs QQQ -2.38%). Bullish Order Block ~$240. ATAI Russell 2000 add Jun 29 = forced passive buying. SMT divergence widening.",
 divergence:"SMT Divergence: IWM -1.70% vs QQQ -2.38% on a risk-off day = IWM is the STRONGER instrument. Per TTrades SMT: when the weaker-narrative asset shows strength vs its correlated pair, that is the setup. AMD: small cap Accumulation ending — Russell add catalysts (ATAI Jun 29) = Distribution phase beginning upward. Retail bearish on IWM = the retail trap.",
 phaseNote:"READY — IWM relative strength. C2 at $240–$245 OB + C3 body close above = call entry. Classic Expansion weekly profile. 9:30: gap up on Russell add + hold above $250 = confirmation.",
 entryNote:"C2 at $240–$245 + C3 body close above = call entry. Protected swing = C2 wick low. Fib $270→C2 low for targets. ATAI + IWM = dual exposure to Russell rotation thesis.",
 invalidation:"Daily body close below $240 (Bullish OB / protected swing violated — wick through does NOT count)",
 levels:[{p:"$270",l:"-1 extension target",c:"#3D8B6E"},{p:"$260",l:"Prior resistance",c:"#C9A84C"},{p:"$249.33",l:"Current — relative strength",c:"#2A8B7A"},{p:"$240",l:"50% Fib / invalidation",c:"#C0445A"}],
 cats:["Small/microcap outperformance signal Jun 27","ATAI Russell 2000 addition Jun 29 — passive inflows","Years of underperformance vs large caps — rotation catalyst","Healthcare and REITs attracting buyers"],
 },
];
const AS_OF = "Jul 1, 2026";
const PHASE_ORDER = ["READY","RETRACEMENT","CONSOLIDATION","EXPANSION","MANAGING","WATCH_REVERSAL"];
const TL_STEPS = ["EXPANSION","CONSOLIDATION","RETRACEMENT","READY","MANAGING"];
export default function OptionsScanner() {
 const [view, setView] = useState("all");
 const [dir, setDir] = useState("both");
 const [cap, setCap] = useState("all");
 const [phase, setPhase] = useState("all");
 const [iraB, setIraB] = useState("");
 const [indB, setIndB] = useState("");
 const [open, setOpen] = useState({ABCL:true});
 const [tabs, setTabs] = useState({});
 const [favs, setFavs] = useState([]);
 const [checks, setChecks] = useState({});
 const [ts, setTs] = useState(null);
 const [refreshing, setRefreshing] = useState(false);
 const [hint, setHint] = useState(false);
 const [fwOpen, setFwOpen] = useState(false);
 const [sessionProfile, setSessionProfile] = useState(()=>getSessionProfile());
 const [weeklyProfile, setWeeklyProfile] = useState(()=>getWeeklyProfile());
 const [panelOpen, setPanelOpen] = useState(false);
 const [evPhase, setEvPhase] = useState("all");
 const [liveData, setLiveData] = useState({});
 const [liveError, setLiveError] = useState(null);
 const [liveTs, setLiveTs] = useState(null);
 const [aiUpdates, setAiUpdates] = useState({});
 const [refreshStatus, setRefreshStatus] = useState("");
 const [evAsset, setEvAsset] = useState("all");
 const [evDir, setEvDir] = useState("all");
 const [evSort, setEvSort] = useState("phase");
 const [memoryData, setMemoryData] = useState({});
 const [screenerHits, setScreenerHits] = useState([]);
 const [screenerMeta, setScreenerMeta] = useState({});
 const [screenerLoading, setScreenerLoading] = useState(true);
 const [scrExpand, setScrExpand] = useState({});
 const [scrSort, setScrSort] = useState("score");
 const [scrBias, setScrBias] = useState("all");
 const [compact, setCompact] = useState(false);
 const [closedTrades, setClosedTrades] = useState([]);
 const [openScreenerRows, setOpenScreenerRows] = useState({});
 useEffect(() => {
 (async () => {
 const [f,c,t,ai,mem,cl] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_closed_trades",[])]);
 setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setClosedTrades(cl||[]);
 })();
 }, []);
 useEffect(()=>{
 fetch("./data/stocks.json?_="+Date.now())
 .then(r=>r.json())
 .then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);})
 .catch(()=>setScreenerLoading(false));
 },[]);
 const updateMarketMemory = useCallback(async (freshPrices) => {
 const all = [...SETUPS,...CRYPTO,...COMMODITIES,...INDICES];
 const key = todayKey();
 setMemoryData(prevMem => {
 const next = {...prevMem};
 for (const s of all) {
 const liveQuote = (freshPrices && freshPrices[s.symbol]) || liveData[s.symbol];
 const aiUpdate = aiUpdates[s.symbol];
 const snap = buildMemorySnapshot(s, liveQuote, aiUpdate);
 const history = next[s.symbol] ? [...next[s.symbol]] : [];
 const lastEntry = history[history.length-1];
 if (lastEntry && lastEntry.date===key) {
 history[history.length-1] = snap;
 } else {
 history.push(snap);
 }
 next[s.symbol] = history.slice(-MEMORY_MAX_DAYS);
 }
 ss("of_memory", next);
 return next;
 });
 }, [liveData, aiUpdates]);

 const doRefresh = useCallback(async () => {
  setRefreshing(true);
  setLiveError(null);

  const EQUITY_SYMS = ["ABCL","ATAI","SMCI","SPCX","MLYS","ILLR","GLD","SLV","CPER","PPLT","PALL","USO","UNG","SPY","QQQ","DIA","IWM"];
  const CRYPTO_SYMS = ["BTC","ETH","SOL","LTC"];

  let allPrices = {};
  let allErrors = [];

  // Crypto — CoinGecko (Polygon/Finnhub free tiers exclude crypto)
  setRefreshStatus("Fetching crypto...");
  try {
    const cgIds = {BTC:"bitcoin",ETH:"ethereum",SOL:"solana",LTC:"litecoin"};
    const cgResp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(cgIds).join(",")}&vs_currencies=usd&include_24hr_change=true`);
    const cgJson = await cgResp.json();
    const cryptoPrices = {};
    for (const [sym,id] of Object.entries(cgIds)) {
      if (cgJson[id]) cryptoPrices[sym] = {price:cgJson[id].usd, chg:cgJson[id].usd_24h_change??0};
    }
    allPrices = {...allPrices, ...cryptoPrices};
    setLiveData(prev => ({...prev, ...cryptoPrices}));
  } catch(e) {
    allErrors.push("crypto (CoinGecko): " + e.message);
  }

  // Equities — single batch call via Worker (Finnhub, 60 req/min free tier)
  setRefreshStatus("Fetching equities...");
  try {
    const resp = await fetch(`${WORKER}?symbols=${EQUITY_SYMS.join(",")}`, {headers:{Accept:"application/json"}});
    const json = await resp.json();
    if (json.prices) allPrices = {...allPrices, ...json.prices};
    if (json.errors) allErrors = [...allErrors, ...json.errors];
    setLiveData(prev => ({...prev, ...(json.prices||{})}));
  } catch(e) {
    allErrors.push("equities: " + e.message);
  }

  const lts = new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  setLiveTs(lts);
  if (allErrors.length > 0) {
    setLiveError(`⚠ ${allErrors.length} symbol(s) failed: ${allErrors.slice(0,3).join("; ")}${allErrors.length>3?"...":""}`);
  } else {
    setLiveError(null);
  }

  setRefreshStatus("Updating memory...");
  await updateMarketMemory(allPrices);
  setRefreshStatus("");
  const t = new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"});
  setTs(t); ss("of_ts",t);
  setSessionProfile(getSessionProfile());
  setWeeklyProfile(getWeeklyProfile());
  setRefreshing(false);
  setHint(true);
  setTimeout(()=>setHint(false),4000);
 }, [updateMarketMemory]);

 // Auto-refresh every 15 minutes
 useEffect(() => {
 const interval = setInterval(() => {
 doRefresh();
 }, 60 * 1000);
 return () => clearInterval(interval);
 }, [doRefresh]);
 // Fire live data refresh once on mount (useRef avoids infinite-loop from dep array)
 const _doRefreshRef = useRef(null);
 useEffect(() => { _doRefreshRef.current = doRefresh; }, [doRefresh]);
 useEffect(() => { _doRefreshRef.current?.(); }, []);
 const toggleFav = useCallback((sym) => {
 setFavs(p => { const n=p.includes(sym)?p.filter(s=>s!==sym):[...p,sym]; ss("of_favs",n); return n; });
 }, []);
 const toggleCheck = useCallback((sym, id) => {
 setChecks(p => {
 const sc=p[sym]||[];
 const n={...p,[sym]:sc.includes(id)?sc.filter(i=>i!==id):[...sc,id]};
 ss("of_checks",n); return n;
 });
 }, []);
 const clearChecks = useCallback((sym) => {
 setChecks(p => { const n={...p,[sym]:[]}; ss("of_checks",n); return n; });
 }, []);
 const WORKER = window.location.hostname === "localhost"
   ? "/worker"
   : "https://market.electronmailbag.workers.dev";


 const tog = (sym) => setOpen(p=>({...p,[sym]:!p[sym]}));
 const setTab = (sym,t) => setTabs(p=>({...p,[sym]:t}));
 const getTab = (sym) => tabs[sym]||"narrative";
 const cc = (v) => v>0?T.blue:v<0?T.rose:T.textSec;
 const altMap={"crypto":CRYPTO,"commodities":COMMODITIES,"indices":INDICES};
 const isAltView=["crypto","commodities","indices"].includes(view);
 const isEverything=view==="everything";
 const altData=altMap[view]||[];
 const ASSET_MAP={"options":SETUPS,"crypto":CRYPTO,"commodities":COMMODITIES,"indices":INDICES};
 const everythingData=evAsset==="all"?[...SETUPS,...CRYPTO,...COMMODITIES,...INDICES]:ASSET_MAP[evAsset]||[];

 // ── Alignment score: ranks setups by actionability using real framework
 // fields only — phase, checklist completion, invalidation state, and
 // proximity to a key level. Higher = closer to actionable entry.
 const alignmentScore = (s) => {
  const hist = memoryData[s.symbol]||[];
  const last = hist[hist.length-1];
  // Invalidated setups sink to the bottom regardless of anything else
  if (last && last.invalidated) return -100;
  const phaseRank = {READY:50,RETRACEMENT:35,EXPANSION:25,WATCH_REVERSAL:15,MANAGING:10,CONSOLIDATION:5}[s.phase]||0;
  // Checklist: manual checks + auto checks, each worth 4 pts
  const ck = new Set([...(checks[s.symbol]||[]),...(s.autoChecks||[])]);
  const ckScore = ck.size * 4;
  // Key-level proximity: if live price is within 3% of any key level, +15
  const ld = liveData[s.symbol];
  const p = ld?.price || s.price;
  let proxScore = 0;
  if (s.keyLevels && p) {
   for (const lvl of s.keyLevels) {
    const lp = parseFloat(String(lvl.p||"").replace(/[$,]/g,""));
    if (lp && Math.abs((p-lp)/lp) < 0.03) { proxScore = 15; break; }
   }
  }
  return phaseRank + ckScore + proxScore;
 };

 const visible = isEverything ? everythingData.filter(s=>{
 if(evPhase!=="all"&&s.phase!==evPhase)return false;
 const d=s.direction||s.dir;
 if(evDir==="bull"&&d!=="call"&&d!=="long")return false;
 if(evDir==="bear"&&d!=="put"&&d!=="short")return false;
 return true;
 }).sort((a,b)=>{
 if(evSort==="phase") return PHASE_ORDER.indexOf(a.phase)-PHASE_ORDER.indexOf(b.phase);
 if(evSort==="chg") return Math.abs(b.chg||0)-Math.abs(a.chg||0);
 if(evSort==="symbol") return (a.symbol||"").localeCompare(b.symbol||"");
 if(evSort==="align") return alignmentScore(b)-alignmentScore(a);
 if(evSort==="asset"){
 const rank=s=>SETUPS.includes(s)?0:CRYPTO.includes(s)?1:COMMODITIES.includes(s)?2:3;
 return rank(a)-rank(b);
 }
 return 0;
 })
 : isAltView ? altData.filter(s=>phase==="all"||s.phase===phase)
 .sort((a,b)=>phase==="all"?PHASE_ORDER.indexOf(a.phase)-PHASE_ORDER.indexOf(b.phase):0)
 : SETUPS.filter(s => {
 if (view==="managing") return s.isActive;
 if (view==="favorites") return favs.includes(s.symbol);
 if (view==="closed") return false;
 if (s.isActive) return false;
 if (dir==="calls" && s.direction!=="call") return false;
 if (dir==="puts" && s.direction!=="put") return false;
 if (dir==="watch" && s.direction!=="watch") return false;
 if (cap!=="all" && s.capSize.toLowerCase()!==cap) return false;
 if (phase!=="all" && s.phase!==phase) return false;
 return true;
 }).sort((a,b)=>alignmentScore(b)-alignmentScore(a));
 const sel = {background:T.surface,border:"1px solid "+T.border,color:T.textPri,padding:"6px 10px",fontSize:11,borderRadius:4,fontFamily:FM,outline:"none",cursor:"pointer"};
 const tbtn = (active,color) => ({flexShrink:0,padding:"8px 12px",fontSize:10,background:"transparent",border:"none",borderBottom:active?"2px solid "+(color||T.sage):"2px solid transparent",color:active?(color||T.sage):T.textDim,cursor:"pointer",fontFamily:FM,whiteSpace:"nowrap"});
 const pill = (color) => ({display:"inline-flex",alignItems:"center",fontSize:9,padding:"2px 8px",borderRadius:12,background:color+"18",border:"1px solid "+color+"40",color:color,fontFamily:FM,whiteSpace:"nowrap"});
 return (
 <div style={{background:T.bg,minHeight:"100vh",color:T.textPri,fontFamily:FM}}>
 <div style={{background:"linear-gradient(160deg,#0A1423,#0D1B31)",borderBottom:"1px solid "+T.border,padding:"14px 20px 12px"}}>
 <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
 <div>
 <div style={{fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:24,fontWeight:700,color:T.gold,lineHeight:1}}>Option Flow</div>
 <div style={{fontSize:9,color:T.textDim,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:3}}>Proprietary Options Intelligence</div>
 </div>
 <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 <div style={{position:"relative"}}>
 <button onClick={()=>setPanelOpen(p=>!p)} title="Portfolio & Budget" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:panelOpen?T.gold+"18":"transparent",border:"1px solid "+(panelOpen?T.gold:T.border2),borderRadius:4,cursor:"pointer",color:panelOpen?T.gold:T.textSec,fontSize:16,transition:"all 0.2s"}}>
 ⊞
 </button>
 {panelOpen&&(
 <div style={{position:"absolute",top:40,right:0,width:320,background:T.surface,border:"1px solid "+T.border2,borderRadius:6,boxShadow:"0 8px 24px #00000055",zIndex:100,overflow:"hidden"}}>
 <div style={{display:"flex",borderBottom:"1px solid "+T.border}}>
 {[["managing","📊 Positions"],["budget","💰 Budget"]].map(([v,l])=>(
 <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px 8px",fontSize:10,background:view===v?T.bg:"transparent",border:"none",borderBottom:view===v?"2px solid "+T.sage:"2px solid transparent",color:view===v?T.sage:T.textDim,cursor:"pointer",fontFamily:FM}}>
 {l}
 </button>
 ))}
 </div>
 {view==="managing"&&(
 <div style={{padding:"12px 14px",maxHeight:400,overflowY:"auto"}}>
 <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:10,letterSpacing:"0.05em"}}>ACTIVE POSITIONS · {AS_OF.toUpperCase()}</div>
 {SETUPS.filter(s=>s.isActive).map(s=>{
 const pl=pnlCalc(s.entryPremium,s.price,s.strike,s.direction);
 const dtD=s.expiryDate?daysUntil(s.expiryDate):null;
 const earnD=s.earningsDate?daysUntil(s.earningsDate):null;
 const earnC=earnD!=null?(earnD<=14?T.rose:earnD<=30?T.gold:T.sage):null;
 return(
 <div key={s.symbol} style={{marginBottom:10,padding:"10px 12px",background:T.bg,borderRadius:4,border:"1px solid "+T.border,borderLeft:"2px solid "+T.teal}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
 <span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:T.textPri}}>{s.symbol}</span>
 <span style={{fontFamily:FD,fontSize:12,color:s.chg>0?T.blue:T.rose}}>{s.chg>0?"+":""}{s.chg.toFixed(1)}%</span>
 </div>
 <div style={{fontSize:9,color:T.textDim,marginBottom:6}}>{s.contract}</div>
 {pl&&(
 <div>
 <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
 <span style={{fontSize:9,color:T.textSec}}>Entry ${s.entryPremium.toFixed(2)} → Est. ~${pl.est.toFixed(2)}</span>
 <span style={{fontSize:11,fontWeight:700,color:pl.pct>=0?T.sage:T.rose,fontFamily:FD}}>{pl.pct>=0?"+":""}{pl.pct.toFixed(0)}%</span>
 </div>
 <div style={{height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",borderRadius:2,background:pl.pct>=0?T.teal:T.rose,width:Math.min(100,Math.max(0,pl.pct))+"%"}}/>
 </div>
 <div style={{fontSize:9,color:T.textDim,marginTop:3}}>Intrinsic ${pl.intrinsic.toFixed(2)}</div>
 </div>
 )}
 <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
 {dtD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:(dtD<=7?T.rose:T.border2)+"18",border:"1px solid "+(dtD<=7?T.rose:T.border2)+"44",borderRadius:3,color:dtD<=7?T.rose:T.textDim}}>Exp {dtD}d</span>}
 {earnD!=null&&<span style={{fontSize:8,padding:"1px 6px",background:earnC+"18",border:"1px solid "+earnC+"44",borderRadius:3,color:earnC}}>Earnings {s.earningsLabel} · {earnD}d</span>}
 </div>
 </div>
 );
 })}
 </div>
 )}
 {view==="budget"&&(()=>{
 const ira=parseFloat(iraB)||0, ind=parseFloat(indB)||0;
 const iraMax=ira>0?(ira*0.05).toFixed(2):null, indMax=ind>0?(ind*0.05).toFixed(2):null;
 const activeP=SETUPS.filter(s=>s.isActive);
 const iraUsed=activeP.filter(s=>s.accountFit.some(a=>a.includes("IRA"))).reduce((sum,s)=>sum+(s.entryPremium?s.entryPremium*100:0),0);
 const indUsed=activeP.filter(s=>s.accountFit.some(a=>a.includes("Ind"))).reduce((sum,s)=>sum+(s.entryPremium?s.entryPremium:0),0);
 const inp={background:T.bg,border:"1px solid "+T.border,color:T.textPri,padding:"7px 10px",fontSize:11,borderRadius:4,fontFamily:FM,outline:"none",width:"100%",boxSizing:"border-box"};
 const row=(l,v,c)=>(<div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:9,color:T.textSec}}>{l}</span><span style={{fontSize:11,color:c||T.textPri,fontWeight:600,fontFamily:FD}}>{v}</span></div>);
 return(
 <div style={{padding:"12px 14px",maxHeight:400,overflowY:"auto"}}>
 <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:10,letterSpacing:"0.05em"}}>ACCOUNT TRACKER · 5% RULE</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 {[[iraB,setIraB,iraMax,iraUsed,ira,"IRA",T.teal,"IRA"],[indB,setIndB,indMax,indUsed,ind,"Individual",T.purple,"Ind"]].map(([bal,setBal,max,used,total,label,color,key])=>(
 <div key={key} style={{background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"10px",borderTop:"2px solid "+color}}>
 <div style={{fontSize:10,fontWeight:600,color,marginBottom:8}}>{label}</div>
 <input type="number" placeholder={key==="IRA"?"4000":"67"} value={bal} onChange={e=>setBal(e.target.value)} style={inp}/>
 {max&&<div style={{marginTop:8}}>{row("Max/trade","$"+max,T.sage)}{row("Deployed","$"+used.toFixed(2),T.gold)}{row("Available","$"+(total-used).toFixed(2),(total-used)>0?T.sage:T.rose)}<div style={{height:2,background:T.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",background:color,width:Math.min(100,(used/total)*100)+"%",borderRadius:2}}/></div></div>}
 {!max&&<div style={{fontSize:9,color:T.textDim,marginTop:6}}>Enter balance</div>}
 </div>
 ))}
 </div>
 <div style={{marginTop:10,fontSize:9,color:T.textDim,lineHeight:1.7}}>5% risk constant as account grows. IRA ≤$200/contract · Individual ≤$5/contract.</div>
 </div>
 );
 })()}
 </div>
 )}
 </div>
 <button onClick={doRefresh} disabled={refreshing} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",background:hint?T.sage+"18":"transparent",border:"1px solid "+(hint?T.sage:T.border2),borderRadius:4,cursor:refreshing?"not-allowed":"pointer",color:hint?T.sage:T.textSec,fontSize:11,fontFamily:FM,transition:"all 0.2s"}}>
 <span style={{display:"inline-block",animation:refreshing?"spin 0.8s linear infinite":"none",fontSize:13}}>↻</span>
 {refreshing?(refreshStatus||"Fetching…"):hint?"✓ Live Updated":"Refresh Data"}
 </button>
 </div>
 <span style={{fontSize:9,color:T.textDim,fontFamily:FD,letterSpacing:"0.04em"}}>{ts||AS_OF}</span>
 </div>
 </div>
 </div>
 {(liveTs||liveError)&&(
 <div style={{background:"#060b16",borderBottom:"1px solid "+T.border,padding:"5px 20px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
 {liveTs&&!liveError&&<span style={{fontSize:9,color:T.teal,fontFamily:FD}}>⚡ Live · {liveTs} · {Object.keys(liveData).length} symbols · 15-min delay</span>}
 {liveError&&<span style={{fontSize:9,color:T.rose}}>{liveError}</span>}
 {Object.entries(liveData).filter(([sym,d])=>{
 const all=[...SETUPS,...CRYPTO,...COMMODITIES,...INDICES];
 const s=all.find(x=>x.symbol===sym);
 if(!s||!d.price)return false;
 const levels=(s.keyLevels||s.levels||[]);
 return levels.some(l=>{const lp=parseFloat((l.p||"").replace(/[$,]/g,""));return lp&&Math.abs((d.price-lp)/lp)<0.008;});
 }).map(([sym,d])=>(
 <span key={sym} style={{fontSize:9,padding:"1px 6px",background:T.gold+"20",border:"1px solid "+T.gold+"50",borderRadius:3,color:T.gold}}>
 ⚠ {sym} ${d.price} near key level
 </span>
 ))}
 {Object.entries(liveData).filter(([,d])=>d.marketState==="PRE"&&d.preMarket&&Math.abs(d.preMarketChg||0)>2).map(([sym,d])=>(
 <span key={sym} style={{fontSize:9,padding:"1px 6px",background:(d.preMarketChg>0?T.blue:T.rose)+"20",border:"1px solid "+(d.preMarketChg>0?T.blue:T.rose)+"50",borderRadius:3,color:d.preMarketChg>0?T.blue:T.rose}}>
 {sym} PM ${d.preMarket} ({d.preMarketChg>0?"+":""}{d.preMarketChg}%)
 </span>
 ))}
 </div>
 )}
 {(()=>{
 // ── Market Regime Header: SPY + QQQ + IWM live trend → risk read ──
 const spy = liveData["SPY"]?.chg ?? INDICES.find(x=>x.symbol==="SPY")?.chg ?? 0;
 const qqq = liveData["QQQ"]?.chg ?? INDICES.find(x=>x.symbol==="QQQ")?.chg ?? 0;
 const iwm = liveData["IWM"]?.chg ?? INDICES.find(x=>x.symbol==="IWM")?.chg ?? 0;
 const avg = (spy+qqq+iwm)/3;
 const regime = avg>0.5?{l:"RISK-ON",c:T.sage}:avg<-0.5?{l:"RISK-OFF",c:T.rose}:{l:"NEUTRAL",c:T.gold};
 const smallCapLead = iwm - ((spy+qqq)/2);
 const chip=(lbl,v)=>(
 <span style={{fontSize:9,fontFamily:FD,color:v>0?T.sage:v<0?T.rose:T.textSec}}>
 {lbl} {v>0?"+":""}{(v||0).toFixed(2)}%
 </span>
 );
 return (
 <div style={{position:"sticky",top:0,zIndex:50,background:"#050a14",borderBottom:"1px solid "+T.border,padding:"6px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
 <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",padding:"2px 8px",borderRadius:3,background:regime.c+"18",border:"1px solid "+regime.c+"50",color:regime.c}}>{regime.l}</span>
 {chip("SPY",spy)}
 {chip("QQQ",qqq)}
 {chip("IWM",iwm)}
 {Math.abs(smallCapLead)>0.75&&(
 <span style={{fontSize:9,color:smallCapLead>0?T.teal:T.amber}}>
 {smallCapLead>0?"↑ Small-caps leading (rotation)":"↓ Small-caps lagging (mega-cap led)"}
 </span>
 )}
 <span style={{fontSize:8,color:T.textDim,marginLeft:"auto",fontFamily:FD}}>{sessionProfile.session} · {weeklyProfile.name}</span>
 </div>
 );

 })()}
 {(()=>{
 const _spy=liveData["SPY"]?.chg??INDICES.find(x=>x.symbol==="SPY")?.chg??0;
 const _qqq=liveData["QQQ"]?.chg??INDICES.find(x=>x.symbol==="QQQ")?.chg??0;
 const _iwm=liveData["IWM"]?.chg??INDICES.find(x=>x.symbol==="IWM")?.chg??0;
 const _avg=(_spy+_qqq+_iwm)/3;
 const _reg=_avg>0.5?{l:"RISK-ON",c:T.sage}:_avg<-0.5?{l:"RISK-OFF",c:T.rose}:{l:"NEUTRAL",c:T.gold};
 const _readyT=SETUPS.filter(s=>s.phase==="READY"||s.phase==="RETRACEMENT");
 const _readyS=screenerHits.filter(h=>h.met>=4);
 const _topAll=[...SETUPS.filter(s=>!s.isActive)].sort((a,b)=>alignmentScore(b)-alignmentScore(a));
 const _top=_topAll[0];
 const _earn=SETUPS.filter(s=>s.earningsDate).sort((a,b)=>daysUntil(a.earningsDate)-daysUntil(b.earningsDate));
 const _ne=_earn[0];
 const _nd=_ne?daysUntil(_ne.earningsDate):null;
 const _inv=SETUPS.filter(s=>{const _h=memoryData[s.symbol]||[];const _l=_h[_h.length-1];return _l&&_l.invalidated;}).length;
 const _cell=(lbl,val,col,sub)=>(
  <div style={{padding:"6px 10px",borderRight:"1px solid "+T.border,flex:"1 0 auto",minWidth:75}}>
   <div style={{fontSize:7,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{lbl}</div>
   <div style={{fontSize:11,fontWeight:700,color:col||T.textPri,fontFamily:FD,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{val}</div>
   {sub&&<div style={{fontSize:7,color:T.textDim,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
  </div>
 );
 return(
  <div style={{background:"#050a13",borderBottom:"1px solid "+T.border,display:"flex",overflowX:"auto"}}>
   {_cell("Regime",_reg.l,_reg.c,`SPY ${_spy>=0?"+":""}${_spy.toFixed(1)}%`)}
   {_cell("Ready / Watch",`${_readyT.length+_readyS.length}`,_readyT.length+_readyS.length>0?T.sage:T.textDim,`${_readyT.length} tracked · ${_readyS.length} screener`)}
   {_cell("Top Aligned",_top?_top.symbol:"—",T.gold,_top?PHASES[_top.phase]?.label||_top.phase:"")}
   {_cell("Nearest Earnings",_ne?`${_ne.symbol} ${_nd}d`:"None",_nd!=null&&_nd<21?T.rose:T.textPri,_ne?.earningsLabel||"")}
   {_cell("IRA Cap","$200/trade",T.teal,"5% rule")}
   {_cell("Invalidated",_inv>0?`${_inv} ⚠`:"✓ Clear",_inv>0?T.rose:T.sage,_inv>0?"Review setups":"")}
  </div>
 );
 })()}
 <div style={{display:"flex",borderBottom:"1px solid "+T.border,background:T.surface,overflowX:"auto"}}>
 <button onClick={()=>setView("favorites")} title="Saved" style={{flexShrink:0,padding:"9px 14px",fontSize:15,background:"transparent",border:"none",borderBottom:view==="favorites"?"2px solid "+T.gold:"2px solid transparent",color:view==="favorites"?T.gold:favs.length?T.goldDim:T.border2,cursor:"pointer"}}>
 ★{favs.length>0&&<span style={{fontSize:9,marginLeft:2,color:T.gold}}>{favs.length}</span>}
 </button>
 <button onClick={()=>setCompact(p=>!p)} title={compact?"Exit compact":"Compact scan"} style={{flexShrink:0,marginLeft:"auto",padding:"9px 12px",fontSize:11,background:"transparent",border:"none",borderBottom:compact?"2px solid "+T.textSec:"2px solid transparent",color:compact?T.textSec:T.border2,cursor:"pointer",fontFamily:FM}}>☰</button>
 {[["everything","All"],["all","Options"],["crypto","Crypto"],["commodities","Commodities"],["indices","Indices"],["screener","Screener"],["closed","Closed"]].map(([v,l])=>(
 <button key={v} onClick={()=>setView(v)} style={tbtn(view===v)}>
 {l}
 </button>
 ))}
 </div>
 {isEverything&&(
 <div style={{padding:"10px 20px",borderBottom:"1px solid "+T.border,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",background:T.surface}}>
 {[
 ["Phase",evPhase,setEvPhase,[["all","All Phases"],["READY","Ready to Enter"],["RETRACEMENT","Retracing"],["CONSOLIDATION","Consolidating"],["EXPANSION","Exp."],["WATCH_REVERSAL","Watch Reversal"],["MANAGING","Managing"]]],
 ["Asset Class",evAsset,setEvAsset,[["all","All"],["options","Options"],["crypto","Crypto"],["commodities","Commodities"],["indices","Indices"]]],
 ["Direction",evDir,setEvDir,[["all","All"],["bull","Bullish / Call"],["bear","Bearish / Put"]]],
 ["Sort By",evSort,setEvSort,[["align","⚡ Alignment"],["phase","Phase"],["chg","% Move"],["symbol","Symbol A–Z"],["asset","Asset Class"]]],
 ].map(([label,val,setter,opts])=>(
 <div key={label}>
 <div style={{fontSize:8,color:T.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:FM}}>{label}</div>
 <select value={val} onChange={e=>setter(e.target.value)} style={sel}>
 {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
 </select>
 </div>
 ))}
 <div style={{marginLeft:"auto",fontSize:9,color:T.textDim,alignSelf:"center",fontFamily:FD}}>{visible.length} results</div>
 </div>
 )}
 {view==="all"&&(
 <div style={{padding:"10px 20px",borderBottom:"1px solid "+T.border,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",background:T.surface}}>
 {[["Direction",dir,setDir,[["both","All"],["calls","Calls ↑"],["puts","Puts ↓"],["watch","Watch"]]],
 ["Cap Size",cap,setCap,[["all","All"],["mega","Mega"],["large","Large"],["small","Small"],["micro","Micro"]]],
 ["Phase",phase,setPhase,[["all","All Phases"],["READY","Ready to Enter"],["RETRACEMENT","Retracing"],["CONSOLIDATION","Consolidating"],["EXPANSION","Exp."],["WATCH_REVERSAL","Watch Reversal"]]]
 ].map(([label,val,setter,opts])=>(
 <div key={label}>
 <div style={{fontSize:8,color:T.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
 <select value={val} onChange={e=>setter(e.target.value)} style={sel}>
 {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
 </select>
 </div>
 ))}
 <div style={{marginLeft:"auto",fontSize:9,color:T.textDim,alignSelf:"center",fontFamily:FD}}>{visible.length} results</div>
 </div>
 )}
 {view==="budget_disabled"&&(()=>{
 const ira=parseFloat(iraB)||0, ind=parseFloat(indB)||0;
 const iraMax=ira>0?(ira*0.05).toFixed(2):null, indMax=ind>0?(ind*0.05).toFixed(2):null;
 const activeP=SETUPS.filter(s=>s.isActive);
 const iraUsed=activeP.filter(s=>s.accountFit.some(a=>a.includes("IRA"))).reduce((sum,s)=>sum+(s.entryPremium?s.entryPremium*100:0),0);
 const indUsed=activeP.filter(s=>s.accountFit.some(a=>a.includes("Ind"))).reduce((sum,s)=>sum+(s.entryPremium?s.entryPremium:0),0);
 const inp={background:T.surface,border:"1px solid "+T.border,color:T.textPri,padding:"8px 10px",fontSize:12,borderRadius:4,fontFamily:FM,outline:"none",width:"100%",boxSizing:"border-box"};
 const lbl={fontSize:8,color:T.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4};
 const row=(l,v,c)=>(<div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,color:T.textSec}}>{l}</span><span style={{fontSize:13,color:c||T.textPri,fontWeight:600,fontFamily:FD}}>{v}</span></div>);
 return(
 <div style={{padding:"20px"}}>
 <div style={{fontSize:9,color:T.textDim,fontFamily:FD,marginBottom:16}}>{AS_OF} · 5% risk rule</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
 {[[iraB,setIraB,iraMax,iraUsed,ira,"IRA Account",T.teal,"IRA"],[indB,setIndB,indMax,indUsed,ind,"Individual",T.purple,"Ind"]].map(([bal,setBal,max,used,total,label,color,key])=>(
 <div key={key} style={{background:T.surface,border:"1px solid "+T.border,borderRadius:6,padding:14,borderTop:"2px solid "+color}}>
 <div style={{fontSize:12,fontWeight:600,color,marginBottom:10}}>{label}</div>
 <div style={lbl}>Balance ($)</div>
 <input type="number" placeholder={key==="IRA"?"4000":"67"} value={bal} onChange={e=>setBal(e.target.value)} style={inp}/>
 {max&&<div style={{marginTop:10}}>{row("Max per trade","$"+max,T.sage)}{row("Deployed est.","$"+used.toFixed(2),T.gold)}{row("Available","$"+(total-used).toFixed(2),(total-used)>0?T.sage:T.rose)}<div style={{height:3,background:T.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",background:color,width:Math.min(100,(used/total)*100)+"%",borderRadius:2}}/></div></div>}
 {!max&&<div style={{fontSize:10,color:T.textDim,marginTop:8}}>Enter balance to calculate</div>}
 </div>
 ))}
 </div>
 <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:6,padding:12,fontSize:10,color:T.textSec,lineHeight:1.8}}>
 <div style={{color:T.gold,fontWeight:600,marginBottom:3}}>Scaling Rule</div>
 5% risk stays constant as account grows. IRA target ≤$200/contract · Individual ≤$5/contract at current size.
 </div>
 </div>
 );
 })()}
 {view==="favorites"&&visible.length===0&&(<div style={{padding:"60px 20px",textAlign:"center"}}><div style={{fontSize:32,color:T.border2,marginBottom:10}}>★</div><div style={{fontSize:13,color:T.textSec}}>No saved setups</div><div style={{fontSize:10,color:T.textDim,marginTop:4}}>Tap ★ on any setup to save it here</div></div>)}
 {view==="managing"&&visible.length===0&&(<div style={{padding:"60px 20px",textAlign:"center"}}><div style={{fontSize:13,color:T.textSec}}>No active positions</div></div>)}
 {(isAltView||isEverything)&&(
 <div style={{padding:"10px 20px"}}>
 {visible.map((s)=>{
 const ph=PHASES[s.phase];
 const ai=aiUpdates[s.symbol]||{};
 const memHistory=memoryData[s.symbol]||[];
 const memNarrative=getMemoryNarrative(memHistory);
 const invAlert=getInvalidationAlert(memHistory);
 const isOpen=open[s.symbol];
 const isFav=favs.includes(s.symbol);
 const tab=getTab(s.symbol);
 const ac=ph.color;
 const dc=s.dir==="call"?T.blue:s.dir==="put"?T.rose:T.slate;
 return(
 <div key={s.symbol} style={{marginBottom:10,background:T.surface,border:"1px solid "+T.border,borderRadius:6,borderTop:"2px solid "+ac,overflow:"hidden"}}>
 <div style={{padding:"12px 16px 0"}}>
 <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
 <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
 <button onClick={()=>toggleFav(s.symbol)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontSize:15,color:isFav?T.gold:T.border2,lineHeight:1}}>★</button>
 <span style={{fontFamily:FD,fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",color:T.textPri,letterSpacing:-0.5}}>{s.symbol}</span>
 <span style={{fontSize:10,color:T.textSec,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
 </div>
 <div style={{display:"flex",alignItems:"baseline",gap:6,flexShrink:0,flexWrap:"wrap"}}>
 {(()=>{
 const ld=liveData[s.symbol];
 const ms=ld?.marketState;
 const dp=ms==="PRE"&&ld?.preMarket?(ld.preMarket):(ld?.price||s.price);
 const dc=ms==="PRE"&&ld?.preMarketChg!=null?ld.preMarketChg:(ld?.chg!=null?ld.chg:s.chg);
 const fmt=v=>v>999?v.toLocaleString(undefined,{maximumFractionDigits:2}):v>10?v.toFixed(2):v.toFixed(3);
 return(<>
 <span style={{fontFamily:FD,fontSize:15,fontWeight:600,color:ld?T.textPri:T.textSec}}>${fmt(dp)}</span>
 <span style={{fontFamily:FD,fontSize:11,color:dc>0?T.blue:dc<0?T.rose:T.textSec}}>{dc>0?"+":""}{typeof dc==="number"?Math.abs(dc)>99?Math.round(dc):dc.toFixed(1):s.chg.toFixed(1)}%</span>
 {ld&&<span style={{fontSize:7,padding:"1px 4px",background:ms==="PRE"?T.amber+"20":ms==="POST"||ms==="POSTPOST"?T.purple+"20":T.teal+"20",border:"1px solid "+(ms==="PRE"?T.amber:ms==="POST"||ms==="POSTPOST"?T.purple:T.teal)+"50",borderRadius:2,color:ms==="PRE"?T.amber:ms==="POST"||ms==="POSTPOST"?T.purple:T.teal,fontFamily:FM,whiteSpace:"nowrap"}}>{ms==="PRE"?"PRE-MKT":ms==="POST"||ms==="POSTPOST"?"AFTER-HRS":"● LIVE"}</span>}
 </>);
 })()}
 </div>
 </div>
 <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
 <span style={pill(ac)}>{ph.icon} {ph.label}</span>
 <span style={pill(dc)}>{s.dir==="call"?"Long ↑":s.dir==="put"?"Short ↓":"Watch"}</span>
 {s.cap&&<span style={pill(CAP_COLORS[s.cap]||T.slate)}>{s.cap}</span>}
 {typeof alScore!=="undefined"&&alScore>0&&!invAlert&&<span style={pill(alScore>=70?T.sage:alScore>=35?T.gold:T.textDim)} title="Alignment score">Align {alScore}</span>}
 {invAlert&&<span style={pill(T.rose)}>⚠ INVALIDATED</span>}
 </div>
 {invAlert&&(
 <div style={{marginTop:6,padding:"7px 10px",background:T.rose+"15",border:"1px solid "+T.rose+"50",borderRadius:4,fontSize:10,color:T.rose}}>
 {invAlert}
 </div>
 )}
 <div style={{fontSize:9,color:T.textDim,marginTop:6,paddingBottom:10}}>Vol {s.vol}</div>
 </div>
 {ai.alert&&(
 <div style={{padding:"5px 14px",background:ai.alertLevel==="critical"?T.rose+"18":ai.alertLevel==="warning"?T.gold+"18":T.teal+"18",borderTop:"1px solid "+(ai.alertLevel==="critical"?T.rose:ai.alertLevel==="warning"?T.gold:T.teal)+"40"}}>
 <span style={{fontSize:9,color:ai.alertLevel==="critical"?T.rose:ai.alertLevel==="warning"?T.gold:T.teal,fontFamily:FM}}>
 {ai.alertLevel==="critical"?"⚠ ":ai.alertLevel==="warning"?"⚡ ":"→ "}{ai.alert}
 </span>
 </div>
 )}
 <button onClick={()=>tog(s.symbol)} style={{width:"100%",padding:"5px 16px",background:T.bg,border:"none",borderTop:"1px solid "+T.border,cursor:"pointer",color:T.textDim,fontSize:9,fontFamily:FM,letterSpacing:"0.08em",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
 {isOpen?"COLLAPSE":"VIEW ANALYSIS"} <span style={{fontSize:7}}>{isOpen?"▲":"▼"}</span>
 </button>
 {isOpen&&(
 <div style={{borderTop:"1px solid "+T.border}}>
 <div style={{display:"flex",overflowX:"auto",borderBottom:"1px solid "+T.border,background:T.bg}}>
 {[["narrative","Narrative"],["phase","Phase"],["entry","Entry"],["levels","Levels & Catalysts"]].map(([t,l])=>(
 <button key={t} onClick={()=>setTab(s.symbol,t)} style={tbtn(tab===t,ac)}>{l}</button>
 ))}
 </div>
 <div style={{padding:"14px 16px",fontSize:10,color:T.textSec,lineHeight:1.8}}>
 <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:10}}>DATA AS OF {AS_OF.toUpperCase()}</div>
 {tab==="narrative"&&(
 <div>
 {memNarrative&&(
 <div style={{background:T.teal+"0c",border:"1px solid "+T.teal+"30",borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{fontSize:8,color:T.teal,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>📅 Market Memory · {memHistory.length} session{memHistory.length===1?"":"s"} tracked</div>
 <div style={{fontSize:10,color:T.textSec}}>{memNarrative}</div>
 </div>
 )}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
 <div style={{background:T.bg,borderRadius:4,padding:"9px 11px",border:"1px solid "+T.border}}><div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Narrative</div><div>{s.narrative}</div></div>
 <div style={{background:T.bg,borderRadius:4,padding:"9px 11px",border:"1px solid "+T.border}}><div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Structure</div><div>{s.structure}</div></div>
 </div>
 <div style={{background:T.purple+"10",border:"1px solid "+T.purple+"30",borderRadius:4,padding:"9px 11px"}}><div style={{fontSize:8,color:T.purple,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>🪤 Divergence</div><div style={{color:T.purple}}>{s.divergence}</div></div>
 </div>
 )}
 {tab==="phase"&&(
 <div>
 <div style={{background:weeklyProfile.color+"10",border:"1px solid "+weeklyProfile.color+"30",borderRadius:4,padding:"9px 11px",marginBottom:8}}>
 <div style={{fontSize:8,color:weeklyProfile.color,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Weekly Profile · {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()]}</div>
 <div style={{fontWeight:600,color:weeklyProfile.color,fontSize:11,marginBottom:3}}>{weeklyProfile.name}</div>
 <div style={{fontSize:9,color:T.textSec,lineHeight:1.6}}>{weeklyProfile.desc}</div>
 </div>
 <div style={{background:sessionProfile.color+"10",border:"1px solid "+sessionProfile.color+"30",borderRadius:4,padding:"9px 11px",marginBottom:8}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
 <div style={{fontSize:8,color:sessionProfile.color,textTransform:"uppercase",letterSpacing:"0.1em"}}>Session Profile · {sessionProfile.session}</div>
 {sessionProfile.actionable&&<span style={{fontSize:8,padding:"1px 6px",background:T.sage+"20",border:"1px solid "+T.sage+"40",borderRadius:3,color:T.sage}}>✓ Entry Window</span>}
 </div>
 <div style={{fontWeight:600,color:sessionProfile.color,fontSize:11,marginBottom:4}}>{sessionProfile.profile}</div>
 <div style={{fontSize:9,color:T.textSec,lineHeight:1.6}}>{sessionProfile.note}</div>
 </div>
 <div style={{background:T.bg,border:"1px solid "+ac+"30",borderRadius:4,padding:"9px 11px"}}><div style={{fontSize:8,color:ac,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{ph.label}</div><div style={{color:T.textSec}}>{s.phaseNote}</div></div>
 </div>
 )}
 {tab==="entry"&&(
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Entry — 3-Candle Swing · 4pm Close</div>
 <div style={{marginBottom:10}}>{s.entryNote}</div>
 <div style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"10px 12px"}}>
 <div style={{fontSize:9,color:T.rose}}>Invalidation:{s.invalidation}</div>
 <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+T.border,fontSize:9,color:T.textDim}}>Same framework as Options tab:C2 failure swing + C3 CISD body close. No options params (no delta/DTE/IV) — directional bias only, applies to spot/ETF/futures positioning.</div>
 </div>
 </div>
 )}
 {tab==="levels"&&(
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Key Levels</div>
 {(s.levels||[]).map((l,i)=>(
 <div key={i} style={{display:"flex",gap:10,marginBottom:5,padding:"5px 9px",background:T.bg,borderRadius:3,border:"1px solid "+T.border}}>
 <span style={{fontWeight:700,color:l.c,fontSize:11,minWidth:70,flexShrink:0,fontFamily:FD}}>{l.p}</span>
 <span style={{color:l.c,fontSize:9,marginTop:1}}>{l.l}</span>
 </div>
 ))}
 <div style={{borderTop:"1px solid "+T.border,paddingTop:10,marginTop:6}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Catalysts</div>
 {(s.cats||[]).map((c,i)=>(
 <div key={i} style={{display:"flex",gap:7,marginBottom:4}}><span style={{color:c.startsWith("⚠")?T.gold:T.blue,fontSize:10}}>{c.startsWith("⚠")?"⚠":"→"}</span><span style={{color:c.startsWith("⚠")?T.gold:T.textSec,fontSize:10}}>{c.startsWith("⚠")?c.slice(2):c}</span></div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 {!isAltView&&!isEverything&&view!=="budget"&&(
 <div style={{padding:"10px 20px"}}>
 {view==="all"&&(()=>{
 const focusData=[...SETUPS].map(s=>{
 const hist=memoryData[s.symbol]||[];
 const last=hist[hist.length-1];
 if(last&&last.invalidated)return{s,pScore:-999,al:0,earnD:null,reasons:[]};
 if(!s.phase||s.isActive)return{s,pScore:-100,al:0,earnD:null,reasons:[]};
 let pScore=0;
 const reasons=[];
 if(s.phase==="READY"){pScore+=50;reasons.push("READY");}
 else if(s.phase==="RETRACEMENT"){pScore+=35;reasons.push("Retracing into zone");}
 else if(s.phase==="EXPANSION"){pScore+=25;reasons.push("Expansion — await pullback");}
 else if(s.phase==="CONSOLIDATION")pScore+=5;
 else if(s.phase==="WATCH_REVERSAL")pScore-=10;
 else if(s.phase==="MANAGING")pScore-=30;
 const hit=screenerHits.find(h=>h.ticker===s.symbol);
 if(hit&&hit.met===5){pScore+=25;reasons.push("5/5 screener conditions");}
 else if(hit&&hit.met>=4){pScore+=15;reasons.push(hit.met+"/5 screener conditions");}
 const al=alignmentScore(s);
 if(al>=70){pScore+=15;reasons.push("HTF alignment confirmed");}
 else if(al>=40)pScore+=8;
 const earnD=s.earningsDate?daysUntil(s.earningsDate):null;
 if(earnD!=null&&earnD>7){pScore+=10;reasons.push("Earnings "+earnD+"d away");}
 if(earnD!=null&&earnD<=7)pScore-=20;
 return{s,pScore,al,earnD,reasons};
 }).filter(x=>x.pScore>0).sort((a,b)=>b.pScore-a.pScore).slice(0,3);
 const readyCount=SETUPS.filter(s=>s.phase==="READY"&&!s.isActive).length;
 const watchCount=SETUPS.filter(s=>!s.isActive&&s.phase!=="READY"&&s.phase!=="MANAGING").length;
 const managingCount=SETUPS.filter(s=>s.isActive).length;
 const spy=liveData["SPY"]?.chg??INDICES.find(x=>x.symbol==="SPY")?.chg??0;
 const qqq=liveData["QQQ"]?.chg??INDICES.find(x=>x.symbol==="QQQ")?.chg??0;
 const iwm=liveData["IWM"]?.chg??INDICES.find(x=>x.symbol==="IWM")?.chg??0;
 const avg=(spy+qqq+iwm)/3;
 const regime=avg>0.5?{l:"Bullish Bias",c:T.sage}:avg<-0.5?{l:"Bearish Bias",c:T.rose}:{l:"Neutral",c:T.gold};
 const sensitivityLabel=ph=>{
 if(ph==="READY")return{l:"Valid Today",c:T.sage};
 if(ph==="RETRACEMENT"||ph==="EXPANSION")return{l:"Waiting",c:T.gold};
 if(ph==="MANAGING")return{l:"No Action",c:T.teal};
 return{l:"Monitor",c:T.textDim};
 };
 const NUMS=["①","②","③"];
 const openCloseModal=(s)=>{
  const hit=screenerHits.find(h=>h.ticker===s.symbol);
  setCloseModal({ticker:s.symbol,entryPhase:s.phase,score:hit?.met??null});
  setCloseExitPrice(""); setClosePnlPct(""); setCloseExitReason("TARGET_HIT");
 };
 return(
 <div style={{marginBottom:12,background:"linear-gradient(135deg,#090F1E,#0B1A30)",border:"1px solid "+T.border2,borderRadius:6,overflow:"hidden",borderTop:"2px solid "+T.gold}}>
 <div style={{padding:"9px 16px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
 <div style={{display:"flex",flexDirection:"column",gap:1}}>
 <span style={{fontSize:8,fontWeight:700,letterSpacing:"0.14em",color:T.gold,textTransform:"uppercase",fontFamily:FM}}>Action Queue</span>
 <span style={{fontSize:8,color:T.textDim,fontFamily:FM}}>{focusData.length} setup{focusData.length!==1?"s":""} queued</span>
 </div>
 <div style={{width:"1px",height:28,background:T.border,flexShrink:0}}/>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
 <span style={{fontSize:8,fontWeight:600,color:regime.c,fontFamily:FM}}>{regime.l}</span>
 <span style={{fontSize:8,color:T.textSec,fontFamily:FM}}>Ready <span style={{color:T.sage,fontWeight:700}}>{readyCount}</span></span>
 <span style={{fontSize:8,color:T.textSec,fontFamily:FM}}>Watching <span style={{color:T.gold,fontWeight:700}}>{watchCount}</span></span>
 <span style={{fontSize:8,color:T.textSec,fontFamily:FM}}>Managing <span style={{color:T.teal,fontWeight:700}}>{managingCount}</span></span>
 </div>
 </div>
 {focusData.length===0?(
 <div style={{padding:"14px 16px",fontSize:9,color:T.textDim,fontFamily:FM}}>{"No setups queued. "+(managingCount>0?"All candidates in MANAGING or monitoring phases.":"All candidates in monitoring phases.")}</div>
 ):focusData.map(({s,al,pScore,earnD,reasons},qi)=>{
 const ph=PHASES[s.phase]||PHASES["CONSOLIDATION"];
 const ckItems=[...new Set([...(checks[s.symbol]||[]),...(s.autoChecks||[])])];
 const starCount=Math.round((Math.min(pScore,100)/100)*5);
 const filledS="★".repeat(Math.max(0,Math.min(5,starCount)));
 const emptyS="☆".repeat(5-Math.max(0,Math.min(5,starCount)));
 const dcolor=s.direction==="call"?T.blue:s.direction==="put"?T.rose:T.slate;
 const sens=sensitivityLabel(s.phase);
 return(
 <div key={s.symbol}
 onClick={()=>{setOpen(p=>({...p,[s.symbol]:true}));setTimeout(()=>{document.getElementById("ofc-"+s.symbol)?.scrollIntoView({behavior:"smooth",block:"start"});},60);}}
 style={{padding:"11px 16px",borderBottom:qi<focusData.length-1?"1px solid "+T.border:"none",display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",transition:"background 0.15s"}}
 onMouseEnter={e=>e.currentTarget.style.background=T.border+"30"}
 onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
 <span style={{fontSize:14,color:T.textDim,fontFamily:FD,paddingTop:2,flexShrink:0}}>{NUMS[qi]}</span>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
 <span style={{fontFamily:FD,fontSize:15,fontWeight:700,color:T.textPri,letterSpacing:-0.5}}>{s.symbol}</span>
 <span style={{fontSize:12,letterSpacing:1}}><span style={{color:T.gold}}>{filledS}</span><span style={{color:T.goldDim}}>{emptyS}</span></span>
 <span style={{fontSize:8,padding:"2px 6px",borderRadius:2,background:ph.color+"18",border:"1px solid "+ph.color+"40",color:ph.color,fontFamily:FM,whiteSpace:"nowrap"}}>{ph.icon} {ph.label}</span>
 <span style={{fontSize:8,color:sens.c,fontFamily:FM,fontStyle:"italic"}}>{sens.l}</span>
 </div>
 {reasons.slice(0,3).map((w,wi)=>(
 <div key={wi} style={{fontSize:8,color:T.textSec,fontFamily:FM,lineHeight:1.7}}><span style={{color:T.sage,marginRight:4}}>✓</span>{w}</div>
 ))}
 </div>
 <span style={{fontSize:10,color:T.textDim,alignSelf:"center",flexShrink:0}}>›</span>
 </div>
 );
 })}
 </div>
 );
 })()}
 {view!=="screener"&&visible.map((s,vIdx)=>{const ai=aiUpdates[s.symbol]||{};
 const memHistory=memoryData[s.symbol]||[];
 const memNarrative=getMemoryNarrative(memHistory);
 const invAlert=getInvalidationAlert(memHistory);
 const ld=liveData[s.symbol];
 const ms=ld?.marketState;
 const dispPrice=ms==="PRE"&&ld?.preMarket?ld.preMarket:(ld?.price||s.price);
 const dispChg=ms==="PRE"&&ld?.preMarketChg!=null?ld.preMarketChg:(ld?.chg!=null?ld.chg:s.chg);
 const dispVol=ld?.vol||s.vol;
 const effectivePhase=ai.phase||s.phase;
 const ph=PHASES[effectivePhase]||PHASES[s.phase];
 const ac=ph.color;
 const isOpen=open[s.symbol];
 const isFav=favs.includes(s.symbol);
 const ck=checks[s.symbol]||[];
 const tab=getTab(s.symbol);
 const pl=s.isActive&&s.entryPremium?pnlCalc(s.entryPremium,dispPrice,s.strike,s.direction):null;
 const earnD=s.earningsDate?daysUntil(s.earningsDate):null;
 const earnC=earnD!=null?(earnD<=14?T.rose:earnD<=30?T.gold:T.sage):null;
 const dteD=s.expiryDate?daysUntil(s.expiryDate):null;
 const effectiveAutoChecks=[...new Set([...(ai.autoChecks||s.autoChecks||[])])];
 const allCk=[...new Set([...ck,...effectiveAutoChecks])];
 const pct=Math.round((allCk.length/CHECKLIST.length)*100);
 const alScore=alignmentScore(s);
 const dc=s.direction==="call"?T.blue:s.direction==="put"?T.rose:T.slate;
 if(compact&&!isOpen)return(
  <div key={s.symbol} onClick={()=>tog(s.symbol)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderBottom:"1px solid "+T.border,background:T.surface,cursor:"pointer",borderLeft:"2px solid "+ac}}>
   <button onClick={e=>{e.stopPropagation();toggleFav(s.symbol);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontSize:13,color:isFav?T.gold:T.border2,lineHeight:1,flexShrink:0}}>★</button>
   <span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:T.textPri,minWidth:44,flexShrink:0}}>{s.symbol}</span>
   <PhasePipeline phase={effectivePhase}/>
   <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:dc+"22",color:dc,border:"1px solid "+dc+"44",fontFamily:FM,flexShrink:0}}>{s.direction==="call"?"↑ CALL":s.direction==="put"?"↓ PUT":"WATCH"}</span>
   <span style={{fontFamily:FD,fontSize:12,color:T.textPri,marginLeft:"auto",flexShrink:0}}>${(liveData[s.symbol]?.price||s.price).toFixed(2)}</span>
   <span style={{fontFamily:FD,fontSize:10,color:dispChg>0?T.blue:dispChg<0?T.rose:T.textSec,flexShrink:0}}>{dispChg>0?"+":""}{typeof dispChg==="number"?dispChg.toFixed(1):s.chg.toFixed(1)}%</span>
   {earnD!=null&&earnD<=21&&<span style={{fontSize:8,color:earnC,flexShrink:0}}>⚡{earnD}d</span>}
   {invAlert&&<span style={{fontSize:8,color:T.rose,flexShrink:0}}>⚠</span>}
   <span style={{fontSize:8,color:T.border2}}>›</span>
  </div>
 );
 return(
 <div id={"ofc-"+s.symbol} key={s.symbol} style={{marginBottom:10,background:T.surface,border:"1px solid "+T.border,borderRadius:6,borderTop:"2px solid "+ac,overflow:"hidden"}}>
 <div style={{padding:"12px 16px 0"}}>
 <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
 <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
 <button onClick={()=>toggleFav(s.symbol)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontSize:15,color:isFav?T.gold:T.border2,lineHeight:1}}>★</button>
 <span style={{fontFamily:FD,fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",color:T.textPri,letterSpacing:-0.5}}>{s.symbol}</span>
 <span style={{fontSize:10,color:T.textSec,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.company}</span>
 {s.isActive&&<span style={pill(T.teal)}>● Active</span>}
 </div>
 <div style={{display:"flex",alignItems:"baseline",gap:6,flexShrink:0,flexWrap:"wrap"}}>
 {(()=>{
 const ld=liveData[s.symbol];
 const ms=ld?.marketState;
 const dp=ms==="PRE"&&ld?.preMarket?(ld.preMarket):(ld?.price||s.price);
 const dc=ms==="PRE"&&ld?.preMarketChg!=null?ld.preMarketChg:(ld?.chg!=null?ld.chg:s.chg);
 const fmt=v=>v>999?v.toLocaleString(undefined,{maximumFractionDigits:2}):v>10?v.toFixed(2):v.toFixed(3);
 return(<>
 <span style={{fontFamily:FD,fontSize:15,fontWeight:600,color:ld?T.textPri:T.textSec}}>${fmt(dp)}</span>
 <span style={{fontFamily:FD,fontSize:11,color:dc>0?T.blue:dc<0?T.rose:T.textSec}}>{dc>0?"+":""}{typeof dc==="number"?Math.abs(dc)>99?Math.round(dc):dc.toFixed(1):s.chg.toFixed(1)}%</span>
 {ld&&<span style={{fontSize:7,padding:"1px 4px",background:ms==="PRE"?T.amber+"20":ms==="POST"||ms==="POSTPOST"?T.purple+"20":T.teal+"20",border:"1px solid "+(ms==="PRE"?T.amber:ms==="POST"||ms==="POSTPOST"?T.purple:T.teal)+"50",borderRadius:2,color:ms==="PRE"?T.amber:ms==="POST"||ms==="POSTPOST"?T.purple:T.teal,fontFamily:FM,whiteSpace:"nowrap"}}>{ms==="PRE"?"PRE-MKT":ms==="POST"||ms==="POSTPOST"?"AFTER-HRS":"● LIVE"}</span>}
 </>);
 })()}
 </div>
 </div>
 <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
 {invAlert&&<span style={pill(T.rose)}>⚠ INVALIDATED</span>}
 <span style={pill(ac)}>{ph.icon} {ph.label}</span>
 <span style={pill(dc)}>{s.direction==="call"?"Call ↑":s.direction==="put"?"Put ↓":"Watch"}</span>
 {s.retailTrap&&<span style={pill(T.purple)}>🪜 Divergence</span>}
 {vIdx===0&&!invAlert&&!s.isActive&&view!=="managing"&&<span style={pill(T.teal)}>⚡ Top Aligned</span>}
 </div>
 {(earnD!=null||dteD!=null||allCk.length>0)&&(
 <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:5,alignItems:"center"}}>
 {allCk.length>0&&<span style={{fontSize:9,color:T.sage,fontFamily:FD}}>✓ {allCk.length}/{CHECKLIST.length} checks</span>}
 {earnD!=null&&<span style={{fontSize:9,color:earnC,fontFamily:FD}}>Earnings {s.earningsLabel} · {earnD}d</span>}
 {dteD!=null&&<span style={{fontSize:9,color:dteD<=7?T.rose:T.textDim,fontFamily:FD}}>Exp {dteD}d</span>}
 </div>
 )}
 {invAlert&&(
 <div style={{marginTop:8,padding:"8px 10px",background:T.rose+"15",border:"1px solid "+T.rose+"50",borderRadius:4,fontSize:10,color:T.rose}}>
 {invAlert}
 </div>
 )}
 {pl&&(
 <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,padding:"8px 0",borderTop:"1px solid "+T.border,flexWrap:"wrap"}}>
 <span style={{fontSize:9,color:T.textDim}}>Entry ${s.entryPremium.toFixed(2)} →</span>
 <span style={{fontSize:10,color:T.teal,fontFamily:FD}}>~${pl.est.toFixed(2)}</span>
 <span style={{fontSize:13,fontWeight:700,color:pl.pct>=0?T.sage:T.rose,fontFamily:FD}}>{pl.pct>=0?"+":""}{pl.pct.toFixed(0)}%</span>
 <div style={{flex:1,height:3,background:T.border,borderRadius:2,overflow:"hidden",maxWidth:60}}>
 <div style={{height:"100%",borderRadius:2,background:pl.pct>=0?T.teal:T.rose,width:Math.min(100,Math.max(0,pl.pct))+"%"}}/>
 </div>
 <span style={{fontSize:9,color:T.textDim}}>Intrinsic ${pl.intrinsic.toFixed(2)}</span>
 <button onClick={()=>openCloseModal(s)} style={{marginLeft:"auto",padding:"4px 10px",background:T.rose+"18",border:"1px solid "+T.rose+"50",borderRadius:3,color:T.rose,fontSize:9,cursor:"pointer",fontFamily:FM,flexShrink:0}}>Close Trade</button>
 </div>
 )}
 <div style={{display:"flex",gap:8,marginTop:8,paddingBottom:10,flexWrap:"wrap",alignItems:"center"}}>
 <span style={{fontSize:9,color:T.textDim,fontFamily:FD}}>Vol {dispVol}</span>
 <span style={{fontSize:9,color:CAP_COLORS[s.capSize]||T.textDim,fontFamily:FD}}>{s.capSize} · {s.mcap}</span>
 {s.accountFit.map((a,i)=><span key={i} style={{fontSize:9,color:T.textDim}}>💼 {a}</span>)}
 </div>
 </div>
 {ai.alert&&(
 <div style={{padding:"5px 14px",background:ai.alertLevel==="critical"?T.rose+"18":ai.alertLevel==="warning"?T.gold+"18":T.teal+"18",borderTop:"1px solid "+(ai.alertLevel==="critical"?T.rose:ai.alertLevel==="warning"?T.gold:T.teal)+"40"}}>
 <span style={{fontSize:9,color:ai.alertLevel==="critical"?T.rose:ai.alertLevel==="warning"?T.gold:T.teal,fontFamily:FM}}>
 {ai.alertLevel==="critical"?"⚠ ":ai.alertLevel==="warning"?"⚡ ":"→ "}{ai.alert}
 </span>
 </div>
 )}
 <button onClick={()=>tog(s.symbol)} style={{width:"100%",padding:"5px 16px",background:T.bg,border:"none",borderTop:"1px solid "+T.border,cursor:"pointer",color:T.textDim,fontSize:9,fontFamily:FM,letterSpacing:"0.08em",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
 {isOpen?"COLLAPSE":"VIEW ANALYSIS"} <span style={{fontSize:7}}>{isOpen?"▲":"▼"}</span>
 </button>
 {isOpen&&(
 <div style={{borderTop:"1px solid "+T.border}}>
 <div style={{display:"flex",overflowX:"auto",borderBottom:"1px solid "+T.border,background:T.bg}}>
 {[["narrative","Narrative"],["phase","Phase"],["checklist","Checklist"],["entry","Entry"],["levels","Levels & Catalysts"],["mtf","Multi-TF"]].map(([t,l])=>(
 <button key={t} onClick={()=>setTab(s.symbol,t)} style={tbtn(tab===t,ac)}>{l}</button>
 ))}
 </div>
 <div style={{padding:"14px 16px",fontSize:10,color:T.textSec,lineHeight:1.8}}>
 <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:10}}>DATA AS OF {AS_OF.toUpperCase()}</div>
 {tab==="narrative"&&(()=>{
 const sameDir=SETUPS.filter(x=>!x.isActive&&x.direction===s.direction&&x.symbol!==s.symbol);
 const rsLeader=sameDir.length>0?[...sameDir].sort((a,b)=>Math.abs(b.chg||0)-Math.abs(a.chg||0))[0]:null;
 return(
 <div>
 {memNarrative&&(
 <div style={{background:T.teal+"0c",border:"1px solid "+T.teal+"30",borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
 <div style={{fontSize:8,color:T.teal,textTransform:"uppercase",letterSpacing:"0.1em"}}>📅 Market Memory · {memHistory.length} session{memHistory.length===1?"":"s"} tracked</div>
 </div>
 <div style={{fontSize:10,color:T.textSec}}>{memNarrative}</div>
 </div>
 )}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
 <div style={{background:T.bg,borderRadius:4,padding:"9px 11px",border:"1px solid "+T.border}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Narrative</div>
 <div style={{fontSize:10,color:T.textSec}}>{s.narrative}</div>
 </div>
 <div style={{background:T.bg,borderRadius:4,padding:"9px 11px",border:"1px solid "+T.border}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Structure</div>
 <div style={{fontSize:10,color:T.textSec}}>{s.structure}</div>
 </div>
 </div>
 <div style={{background:T.purple+"10",border:"1px solid "+T.purple+"30",borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{fontSize:8,color:T.purple,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>🪤 Divergence — Your Edge</div>
 <div style={{color:T.purple,fontSize:10}}>{s.divergence}</div>
 </div>
 {sameDir.length>0&&(
 <div style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Relative Strength · {s.direction==="call"?"Bullish":"Bearish"} Setups</div>
 {[s,...sameDir].sort((a,b)=>Math.abs(b.chg||0)-Math.abs(a.chg||0)).map((x,i)=>(
 <div key={x.symbol} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,padding:"4px 6px",borderRadius:3,background:x.symbol===s.symbol?T.sage+"10":"transparent",border:x.symbol===s.symbol?"1px solid "+T.sage+"30":"1px solid transparent"}}>
 <span style={{fontSize:9,fontWeight:700,color:x.symbol===s.symbol?T.sage:T.textSec,fontFamily:FD,minWidth:44}}>{x.symbol}</span>
 <div style={{flex:1,height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",background:x.symbol===s.symbol?T.sage:T.border2,width:Math.min(100,Math.abs(x.chg||0)*3)+"%",borderRadius:2}}/>
 </div>
 <span style={{fontSize:9,color:x.chg>0?T.blue:T.rose,fontFamily:FD,minWidth:38,textAlign:"right"}}>{x.chg>0?"+":""}{typeof x.chg==="number"?x.chg.toFixed(1):"—"}%</span>
 {i===0&&<span style={{fontSize:7,padding:"1px 4px",background:T.gold+"20",border:"1px solid "+T.gold+"40",borderRadius:2,color:T.gold}}>leader</span>}
 </div>
 ))}
 {rsLeader&&rsLeader.symbol!==s.symbol&&(
 <div style={{marginTop:6,fontSize:9,color:T.gold,lineHeight:1.6}}>⚡ {rsLeader.symbol} showing stronger momentum. If entering {s.direction==="call"?"calls":"puts"} today, consider {rsLeader.symbol} as the primary vehicle.</div>
 )}
 {sameDir.length>0&&(()=>{
 const sorted=[s,...sameDir].sort((a,b)=>Math.abs(b.chg||0)-Math.abs(a.chg||0));
 const top=sorted[0], bot=sorted[sorted.length-1];
 const isDiverging=top.symbol!==bot.symbol&&Math.abs((top.chg||0)-(bot.chg||0))>5;
 return isDiverging?(
 <div style={{marginTop:6,padding:"6px 8px",background:T.purple+"10",border:"1px solid "+T.purple+"30",borderRadius:3}}>
 <div style={{fontSize:8,color:T.purple,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>⚡ SMT Divergence — Confluence Only</div>
 <div style={{fontSize:9,color:T.purple,lineHeight:1.6}}>
 {top.symbol} ({top.chg>0?"+":""}{(top.chg||0).toFixed(1)}%) and {bot.symbol} ({bot.chg>0?"+":""}{(bot.chg||0).toFixed(1)}%) are diverging by {Math.abs((top.chg||0)-(bot.chg||0)).toFixed(1)}%. If they are correlated, the weaker ({bot.symbol}) signals the real direction. Per TTrades: SMT is confluence, not the trade foundation. Confirm C2 closure and CISD on the weaker asset before entering. The weaker instrument in a divergence = the primary vehicle once the fractal is confirmed.
 </div>
 </div>
 ):null;
 })()}
 </div>
 )}
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Update Log</div>
 {ai.logEntry&&(
 <div style={{padding:"9px 11px",background:T.teal+"08",borderRadius:4,borderLeft:"2px solid "+T.teal,marginBottom:5}}>
 <div style={{fontSize:8,color:T.teal,fontFamily:FD,marginBottom:3}}>{aiUpdates._ts||"Today"} <span style={{marginLeft:6,fontSize:7,padding:"1px 4px",background:T.teal+"20",border:"1px solid "+T.teal+"40",borderRadius:2}}>🤖 AI</span></div>
 <div style={{color:T.textSec,fontSize:10}}>{ai.logEntry}</div>
 </div>
 )}
 {s.logEntry&&(
 <div style={{padding:"9px 11px",background:T.bg,borderRadius:4,borderLeft:"2px solid "+T.border2}}>
 <div style={{fontSize:8,color:T.textDim,fontFamily:FD,marginBottom:4}}>{s.logEntry.ts} <span style={{color:T.sage,marginLeft:6}}>● base</span></div>
 <div style={{color:T.textSec,fontSize:10}}>{s.logEntry.note}</div>
 </div>
 )}
 </div>
 </div>
 );
 })()}
 {tab==="phase"&&(()=>{
 const ci=TL_STEPS.indexOf(s.phase);
 
 const sameDir=SETUPS.filter(x=>!x.isActive&&x.direction===s.direction&&x.symbol!==s.symbol&&x.phase!=="EXPANSION");
 return(
 <div>
 <div style={{background:sessionProfile.color+"10",border:"1px solid "+sessionProfile.color+"30",borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
 <div style={{fontSize:8,color:sessionProfile.color,textTransform:"uppercase",letterSpacing:"0.1em"}}>Session Profile · {sessionProfile.session}</div>
 {sessionProfile.actionable&&<span style={{fontSize:8,padding:"1px 6px",background:T.sage+"20",border:"1px solid "+T.sage+"40",borderRadius:3,color:T.sage}}>✓ Entry Window</span>}
 </div>
 <div style={{fontWeight:600,color:sessionProfile.color,fontSize:11,marginBottom:3}}>{sessionProfile.profile}</div>
 <div style={{fontSize:9,color:T.textSec,lineHeight:1.6}}>{sessionProfile.note}</div>
 <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid "+sessionProfile.color+"20",fontSize:9,color:T.textDim}}>
 <span style={{color:sessionProfile.color,fontWeight:600}}>9:30 Rule: </span>
 {s.direction==="call"
 ? "If 9:30 opens above "+( s.keyLevels[s.keyLevels.length-2]?.p||"key level")+", continuation confirmed. If 9:30 creates a manipulation (spike down then closes back up), intraday reversal in play — hold entry."
 : "If 9:30 opens below "+(s.keyLevels[s.keyLevels.length-2]?.p||"key level")+", continuation confirmed. If 9:30 spikes up then closes back below, manipulation reversal in play — hold entry."}
 </div>
 </div>
 <div style={{background:weeklyProfile.color+"10",border:"1px solid "+weeklyProfile.color+"30",borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{fontSize:8,color:weeklyProfile.color,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Weekly Profile · {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()]}</div>
 <div style={{fontWeight:600,color:weeklyProfile.color,fontSize:11,marginBottom:3}}>{weeklyProfile.name}</div>
 <div style={{fontSize:9,color:T.textSec,lineHeight:1.6}}>{weeklyProfile.desc}</div>
 </div>
 <div style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"9px 11px",marginBottom:10}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>AMD Phase (Power of 3)</div>
 <div style={{display:"flex",gap:4}}>
 {[["Accumulation","Asia · consolidation · smart money builds","#4A90D9",!sessionProfile.actionable&&sessionProfile.session==="Asia"],
 ["Manipulation","London/Pre-mkt · fake move · retail trapped","#C9A84C",!sessionProfile.actionable&&sessionProfile.session!=="Asia"&&sessionProfile.session!=="New York"],
 ["Distribution","NY · true directional move begins · your entry","#3D8B6E",sessionProfile.actionable]
 ].map(([label,desc,color,active])=>(
 <div key={label} style={{flex:1,padding:"6px 7px",borderRadius:3,background:active?color+"18":T.bg,border:"1px solid "+(active?color+"40":T.border),transition:"all 0.2s"}}>
 <div style={{fontSize:8,fontWeight:active?700:400,color:active?color:T.textDim,marginBottom:2}}>{label}</div>
 <div style={{fontSize:7,color:T.textDim,lineHeight:1.4}}>{desc}</div>
 </div>
 ))}
 </div>
 </div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Market Structure Cycle</div>
 <div style={{display:"flex",alignItems:"flex-start",marginBottom:14}}>
 {TL_STEPS.map((k,i)=>{
 const isA=k===s.phase, isP=i<ci;
 const pc=PHASES[k]?.color||T.textDim;
 const c=isA?pc:isP?pc+"66":T.border;
 return(
 <div key={k} style={{display:"flex",alignItems:"center",flex:1}}>
 <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
 <div style={{width:isA?16:11,height:isA?16:11,borderRadius:"50%",border:"2px solid "+c,background:isA?pc:isP?pc+"22":"transparent",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isA?"0 0 8px "+pc+"44":"none"}}>
 {isA&&<span style={{fontSize:5,color:T.bg,fontWeight:900}}>●</span>}
 {isP&&<span style={{fontSize:6,color:pc}}>✓</span>}
 </div>
 <div style={{fontSize:7,color:isA?pc:isP?pc+"88":T.border,textAlign:"center",fontWeight:isA?700:400}}>{["Exp","Cons","Ret","Ready","Mgmt"][i]}</div>
 </div>
 {i<TL_STEPS.length-1&&<div style={{width:5,height:1,background:isP?T.border2:T.border,flexShrink:0,marginBottom:12}}/>}
 </div>
 );
 })}
 </div>
 <div style={{background:T.bg,border:"1px solid "+ac+"30",borderRadius:4,padding:"9px 11px",marginBottom:8}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
 <div style={{fontSize:8,color:ac,textTransform:"uppercase",letterSpacing:"0.1em"}}>{ph.label}{ai.phase&&ai.phase!==s.phase?" (updated)":""}</div>
 {ai.phaseNote&&<span style={{fontSize:7,padding:"1px 4px",background:T.teal+"20",border:"1px solid "+T.teal+"40",borderRadius:2,color:T.teal}}>🤖 AI</span>}
 </div>
 <div style={{color:T.textSec}}>{ai.phaseNote||s.phaseNote}</div>
 </div>
 {s.nestedFib&&<div style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"9px 11px"}}><div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Nested Fib · OB Mean Threshold</div><div style={{color:T.gold}}>{s.nestedFib}</div></div>}
 </div>
 );
 })()}
 {tab==="checklist"&&(()=>{
 return(
 <div>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Entry Criteria — {allCk.length}/{CHECKLIST.length}</div>
 <div style={{width:130,height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",borderRadius:2,background:pct===100?T.sage:pct>=50?T.gold:T.rose,width:pct+"%",transition:"width 0.3s"}}/>
 </div>
 </div>
 <div style={{display:"flex",gap:8,alignItems:"center"}}>
 <span style={{fontSize:8,color:T.textDim}}>🤖 auto · ✋ manual</span>
 {ck.length>0&&<button onClick={()=>clearChecks(s.symbol)} style={{fontSize:8,padding:"2px 7px",background:"transparent",border:"1px solid "+T.rose+"40",borderRadius:3,color:T.rose,cursor:"pointer"}}>Clear</button>}
 </div>
 </div>
 {CHECKLIST.map(item=>{
 const isAuto=effectiveAutoChecks.includes(item.id), isMan=ck.includes(item.id), isCk=isAuto||isMan;
 return(
 <div key={item.id} onClick={()=>!isAuto&&toggleCheck(s.symbol,item.id)} style={{display:"flex",gap:8,marginBottom:5,cursor:isAuto?"default":"pointer",padding:"7px 9px",borderRadius:4,background:isAuto?T.sage+"08":isMan?T.teal+"08":T.bg,border:"1px solid "+(isAuto?T.sage+"25":isMan?T.teal+"25":T.border),transition:"all 0.15s"}}>
 <div style={{width:13,height:13,borderRadius:3,flexShrink:0,marginTop:1,background:isAuto?T.sage:isMan?T.teal:"transparent",border:"1.5px solid "+(isAuto?T.sage:isMan?T.teal:T.border2),display:"flex",alignItems:"center",justifyContent:"center"}}>
 {isCk&&<span style={{color:T.bg,fontSize:8,fontWeight:900}}>✓</span>}
 </div>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}>
 <span style={{color:isAuto?T.sage:isMan?T.teal:T.textSec,fontWeight:isCk?600:400,fontSize:10}}>{item.label}</span>
 {isAuto&&<span style={{fontSize:7,padding:"1px 4px",background:T.sage+"15",border:"1px solid "+T.sage+"30",borderRadius:2,color:T.sage}}>auto</span>}
 {isMan&&!isAuto&&<span style={{fontSize:7,padding:"1px 4px",background:T.teal+"15",border:"1px solid "+T.teal+"30",borderRadius:2,color:T.teal}}>manual</span>}
 </div>
 <div style={{color:T.textDim,fontSize:9}}>{item.desc}</div>
 </div>
 </div>
 );
 })}
 {pct===100&&<div style={{marginTop:8,padding:"9px 11px",background:T.sage+"10",border:"1px solid "+T.sage+"30",borderRadius:4,color:T.sage,fontSize:10,textAlign:"center",fontWeight:600}}>All criteria met — ready to execute</div>}
 </div>
 );
 })()}
 {tab==="entry"&&(
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{s.isActive?"Position Management":"Entry — 3-Candle Swing · 4pm Close"}</div>
 <div style={{marginBottom:10}}>{s.entryNote}</div>
 <div style={{background:T.bg,border:"1px solid "+T.border,borderRadius:4,padding:"10px 12px"}}>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Parameters</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
 {[["Delta","0.35–0.45"],["DTE","Farthest affordable"],["IV Rank","< 30"],["Stop","-40% on premium"]].map(([k,v])=>(
 <div key={k}><div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{k}</div><div style={{fontSize:10,color:T.textPri,fontFamily:FD}}>{v}</div></div>
 ))}
 </div>
 <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+T.border,fontSize:9,color:T.rose}}>Invalidation:{s.invalidation} — body close only (wick through = manipulation, not invalidation)</div>
 <div style={{fontSize:9,color:T.textDim,marginTop:3}}>{s.accountFit.join(" · ")}</div>
 </div>
 </div>
 )}
 {tab==="levels"&&(
 <div>
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Key Price Levels</div>
 {s.keyLevels.map((l,i)=>(
 <div key={i} style={{display:"flex",gap:10,marginBottom:5,padding:"5px 9px",background:T.bg,borderRadius:3,border:"1px solid "+T.border}}>
 <span style={{fontWeight:700,color:l.c,fontSize:11,minWidth:50,flexShrink:0,fontFamily:FD}}>{l.p}</span>
 <span style={{color:l.c,fontSize:9,marginTop:1}}>{l.l}</span>
 </div>
 ))}
 <div style={{padding:"5px 9px",background:T.rose+"0a",border:"1px solid "+T.rose+"20",borderRadius:3,marginBottom:12,fontSize:9,color:T.rose}}>Invalidation:{s.invalidation}</div>
 <div style={{borderTop:"1px solid "+T.border,paddingTop:12}}>
 {earnD!=null&&<div style={{marginBottom:8,padding:"7px 10px",background:earnC+"0a",border:"1px solid "+earnC+"30",borderRadius:4}}><div style={{fontSize:8,color:earnC,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Earnings</div><div style={{color:earnC,fontWeight:600,fontFamily:FD}}>{s.earningsLabel} · {earnD} days</div>{dteD!=null&&<div style={{fontSize:9,color:T.textDim,marginTop:2}}>{earnD>dteD?"After expiry — consider rolling":"Within contract window"}</div>}</div>}
 <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Catalysts</div>
 {s.catalysts.map((c,i)=>(
 <div key={i} style={{display:"flex",gap:7,marginBottom:4}}>
 <span style={{color:c.startsWith("⚠")?T.gold:T.blue,fontSize:10}}>{c.startsWith("⚠")?"⚠":"→"}</span>
 <span style={{color:c.startsWith("⚠")?T.gold:T.textSec,fontSize:10}}>{c.startsWith("⚠")?c.slice(2):c}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 {tab==="mtf"&&(()=>{
 const rows=s.mtf||[];
 const bulls=rows.filter(r=>r[1]==="bull").length;
 const bears=rows.filter(r=>r[1]==="bear").length;
 const al=bulls>=4?"Strongly Bullish":bears>=4?"Strongly Bearish":bulls>bears?"Leaning Bullish":bears>bulls?"Leaning Bearish":"Mixed";
 const alC=bulls>=4?T.sage:bears>=4?T.rose:bulls>bears?T.blue:bears>bulls?T.rose:T.amber;
 const dc2=(v)=>v==="bull"?T.sage:v==="bear"?T.rose:v==="neut"?T.amber:T.textDim;
 return(
 <div>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"9px 11px",background:T.bg,borderRadius:4,border:"1px solid "+alC+"30"}}>
 <div><div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Aggregate Bias</div><div style={{fontSize:12,fontWeight:700,color:alC}}>{al}</div></div>
 <div style={{fontSize:9,color:T.textDim}}><span style={{color:T.sage,marginRight:6}}>↑ {bulls}</span><span style={{color:T.rose,marginRight:6}}>↓ {bears}</span></div>
 </div>
 {rows.map(([tf,bias,note],i)=>(
 <div key={i} style={{display:"grid",gridTemplateColumns:"60px 10px 1fr",gap:8,padding:"6px 9px",marginBottom:3,borderRadius:3,background:T.bg,border:"1px solid "+T.border,alignItems:"center"}}>
 <span style={{fontSize:9,color:T.textSec,fontWeight:600}}>{tf}</span>
 <div style={{width:7,height:7,borderRadius:"50%",background:dc2(bias)}}/>
 <span style={{fontSize:9,color:T.textDim}}>{note}</span>
 </div>
 ))}
 <div style={{marginTop:8,fontSize:9,color:T.textDim,padding:"7px 9px",background:T.bg,borderRadius:3,border:"1px solid "+T.border}}>Daily setup valid only when monthly + weekly bias aligns. Counter-trend: shorter DTE, first target only.</div>
 </div>
 );
 })()}
 </div>
 </div>
 )}
 </div>
 );
 })}
 {view==="screener"&&(
 <div style={{padding:16}}>
  {(()=>{
   const topQ=[...SETUPS].filter(s=>!s.isActive).sort((a,b)=>alignmentScore(b)-alignmentScore(a)).slice(0,3);
   if(!topQ.length)return null;
   return(
    <div style={{marginBottom:14,background:T.surface,border:"1px solid "+T.border,borderRadius:6,overflow:"hidden"}}>
     <div style={{padding:"7px 14px",borderBottom:"1px solid "+T.border,background:T.bg,display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FM}}>⚡ Action Queue</span>
      <span style={{fontSize:9,color:T.textDim,marginLeft:"auto",fontFamily:FD}}>Top 3 by alignment</span>
     </div>
     {topQ.map((s,i)=>{
      const ph=PHASES[s.phase];
      const urgency=s.phase==="READY"?"🔴 Enter":s.phase==="RETRACEMENT"?"🟡 Watch C2":"⬜ Building";
      return(
       <div key={s.symbol} style={{padding:"8px 14px",borderBottom:i<topQ.length-1?"1px solid "+T.border:"none",display:"flex",gap:10,alignItems:"center"}}>
        <div style={{minWidth:50}}>
         <div style={{fontSize:12,fontWeight:700,color:i===0?T.gold:T.textPri,fontFamily:FM}}>{s.symbol}</div>
         <div style={{fontSize:8,color:ph?.color||T.textDim,fontFamily:FD,textTransform:"uppercase",letterSpacing:"0.05em"}}>{ph?.label||s.phase}</div>
        </div>
        <div style={{flex:1,fontSize:9,color:T.textSec,fontFamily:FD,lineHeight:1.4}}>{s.phaseNote||s.structure?.slice(0,70)||"—"}</div>
        <div style={{fontSize:8,color:s.phase==="READY"?T.rose:s.phase==="RETRACEMENT"?T.gold:T.textDim,fontFamily:FD,flexShrink:0}}>{urgency}</div>
       </div>
      );
     })}
    </div>
   );
  })()}
  {screenerLoading&&(
   <div style={{textAlign:"center",padding:32,color:T.textSec,fontSize:13,fontFamily:FM}}>Loading screener data...</div>
  )}
  {!screenerLoading&&screenerHits.length===0&&(
   <div style={{textAlign:"center",padding:32}}>
    <div style={{fontSize:13,color:T.textSec,fontFamily:FM}}>No screener data found</div>
    <div style={{fontSize:10,color:T.textDim,marginTop:4}}>Run CI workflow from GitHub Actions to populate</div>
    <button onClick={()=>{setScreenerLoading(true);fetch("./data/stocks.json?_="+Date.now()).then(r=>r.json()).then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);}).catch(()=>setScreenerLoading(false));}} style={{marginTop:12,fontSize:9,padding:"5px 14px",background:T.surface,border:"1px solid "+T.border,color:T.textSec,borderRadius:4,cursor:"pointer",fontFamily:FM}}>Retry</button>
   </div>
  )}
  {!screenerLoading&&screenerHits.length>0&&(
   <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
     <div>
      <div style={{fontSize:11,fontWeight:700,color:T.textPri,fontFamily:FM,letterSpacing:"0.05em"}}>📡 SCREENER HITS</div>
      <div style={{fontSize:9,color:T.textDim,marginTop:3}}>{screenerMeta.universe_size||0} screened · {screenerHits.length} candidates · score ≥4</div>
     </div>
     <button onClick={()=>{setScreenerLoading(true);fetch("./data/stocks.json?_="+Date.now()).then(r=>r.json()).then(d=>{setScreenerHits(d.candidates||[]);setScreenerMeta({generated_at:d.generated_at,universe_size:d.universe_size||0});setScreenerLoading(false);}).catch(()=>setScreenerLoading(false));}} style={{fontSize:9,padding:"4px 10px",background:T.surface,border:"1px solid "+T.border,color:T.textSec,borderRadius:4,cursor:"pointer",fontFamily:FM}}>Refresh</button>
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:12,padding:"8px 10px",background:T.surface,border:"1px solid "+T.border,borderRadius:5}}>
     <div style={{display:"flex",alignItems:"center",gap:5}}>
      <span style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:FM}}>Sort</span>
      <select value={scrSort} onChange={e=>setScrSort(e.target.value)} style={{fontSize:9,padding:"2px 6px",background:T.bg,border:"1px solid "+T.border,color:T.textSec,borderRadius:3,fontFamily:FM,cursor:"pointer"}}>
       <option value="score">Score ↓</option>
       <option value="retr">Retracement %</option>
       <option value="ticker">Ticker A–Z</option>
      </select>
     </div>
     <div style={{display:"flex",alignItems:"center",gap:5}}>
      <span style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:FM}}>Bias</span>
      <select value={scrBias} onChange={e=>setScrBias(e.target.value)} style={{fontSize:9,padding:"2px 6px",background:T.bg,border:"1px solid "+T.border,color:T.textSec,borderRadius:3,fontFamily:FM,cursor:"pointer"}}>
       <option value="all">All</option>
       <option value="BULL">Calls ▲</option>
       <option value="BEAR">Puts ▼</option>
      </select>
     </div>
     <span style={{fontSize:8,color:T.textDim,fontFamily:FD,marginLeft:"auto"}}>{(scrBias==="all"?screenerHits:screenerHits.filter(h=>h.bias===scrBias)).length} shown</span>
    </div>
    {(()=>{
     const allSyms=new Set([...SETUPS,...(CRYPTO||[]),...(COMMODITIES||[]),...(INDICES||[])].map(s=>s.symbol));
     const filtered=scrBias==="all"?screenerHits:screenerHits.filter(h=>h.bias===scrBias);
     const sorted=[...filtered].sort((a,b)=>{
      if(scrSort==="score") return b.met-a.met;
      if(scrSort==="retr") return parseFloat(b.details?.retr_pct||0)-parseFloat(a.details?.retr_pct||0);
      return a.ticker.localeCompare(b.ticker);
     });
     const newHits=sorted.filter(h=>!allSyms.has(h.ticker));
     const tracked=sorted.filter(h=>allSyms.has(h.ticker));
     const biasColor=b=>b==="BULL"?T.green:T.rose;
     const renderTrackedCard=h=>{
      const match=SETUPS.find(s=>s.symbol===h.ticker);
      const expanded=scrExpand[h.ticker];
      const mPh=match?PHASES[match.phase]:null;
      const urgency=match?(match.phase==="READY"?"🔴 Enter":match.phase==="RETRACEMENT"?"🟡 Watch C2":"⬜ Building"):null;
      const retrPct=parseFloat(h.details?.retr_pct||0);
      const retrColor=retrPct<=50?T.sage:T.rose;
      const bc=biasColor(h.bias);
      return(
       <div key={h.ticker} style={{borderBottom:"1px solid "+T.border}}>
        <div style={{padding:"12px 14px"}}>
         <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div>
           <span style={{fontSize:14,fontWeight:700,color:T.textPri,fontFamily:FM}}>{h.ticker}</span>
           <span style={{fontSize:10,color:T.textDim,fontFamily:FD,marginLeft:6}}>${Number(h.price||0).toFixed(2)}</span>
          </div>
          <div style={{background:bc+"22",color:bc,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:3,border:"1px solid "+bc+"44",letterSpacing:"0.08em"}}>{h.bias==="BULL"?"▲ CALL":"▼ PUT"}</div>
          {urgency&&<div style={{fontSize:8,color:match.phase==="READY"?T.rose:match.phase==="RETRACEMENT"?T.gold:T.textDim,fontFamily:FD}}>{urgency}</div>}
          <div style={{marginLeft:"auto",display:"flex",gap:2,alignItems:"center"}}>
           {["topdown_bias","expansion","in_zone","vol_confirm","liquid"].map(k=>(
            <div key={k} title={k} style={{width:8,height:8,borderRadius:2,background:h.conditions?.[k]?T.sage:T.border2}}/>
           ))}
           <span style={{fontSize:10,fontWeight:700,color:h.met===5?T.sage:h.met>=4?T.gold:T.textDim,marginLeft:5,fontFamily:FM}}>{h.met}/5</span>
          </div>
         </div>
         <div style={{marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
           <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>Retracement</span>
           <span style={{fontSize:8,color:retrColor,fontFamily:FD,fontWeight:retrPct<=50?700:400}}>{retrPct.toFixed(1)}%{retrPct<=50?" ✓":""}</span>
          </div>
          <div style={{height:4,borderRadius:2,background:T.border2,overflow:"hidden"}}>
           <div style={{height:"100%",width:Math.min(retrPct,100)+"%",background:retrColor,borderRadius:2}}/>
          </div>
         </div>
         <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:9,color:T.textSec,fontFamily:FD,fontStyle:"italic"}}>
           {h.bias==="BULL"?"Watching for C2 bullish entry":"Watching for C2 bearish entry"}. Retr {retrPct.toFixed(1)}%{retrPct<=50?" — inside 0–50% zone ✓":" — outside zone, wait"}.
          </div>
          {match&&<button onClick={()=>setScrExpand(p=>({...p,[h.ticker]:!p[h.ticker]}))} style={{flexShrink:0,fontSize:8,padding:"3px 10px",background:expanded?T.sage+"20":"transparent",border:"1px solid "+(expanded?T.sage:T.border),color:expanded?T.sage:T.textDim,borderRadius:3,cursor:"pointer",fontFamily:FM,marginLeft:8}}>{expanded?"▲ Hide":"View Analysis"}</button>}
         </div>
        </div>
        {expanded&&match&&(()=>{
         return(
          <div style={{padding:"10px 14px 14px",background:T.bg,borderTop:"1px solid "+T.border}}>
           <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:9,fontWeight:700,color:mPh?.color||T.textDim,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:FM}}>{mPh?.label||match.phase}</span>
            {match.signal&&<span style={{fontSize:9,color:T.textSec,fontFamily:FD,flex:1}}>{match.signal}</span>}
           </div>
           {(match.thesis||match.structure)&&<div style={{fontSize:10,color:T.textSec,lineHeight:1.6,fontFamily:FD,marginBottom:8}}>{(match.thesis||match.structure).slice(0,180)}{(match.thesis||match.structure).length>180?"…":""}</div>}
           {match.keyLevels&&match.keyLevels.slice(0,3).map((kl,ki)=>(
            <div key={ki} style={{display:"flex",gap:8,fontSize:9,color:T.textDim,fontFamily:FD,marginTop:3}}>
             <span style={{color:kl.type==="support"?T.green:kl.type==="resistance"?T.rose:T.gold,minWidth:70,flexShrink:0}}>{kl.label||kl.type}</span>
             <span style={{color:T.textSec}}>{kl.p}</span>
             {kl.note&&<span>— {String(kl.note).slice(0,50)}</span>}
            </div>
           ))}
          </div>
         );
        })()}
       </div>
      );
     };
     const renderCard=h=>{
      const retrPct=parseFloat(h.details?.retr_pct||0);
      const retrColor=retrPct<=50?T.sage:T.rose;
      const bc=biasColor(h.bias);
      return(
       <div key={h.ticker} style={{borderBottom:"1px solid "+T.border,padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
         <div>
          <span style={{fontSize:14,fontWeight:700,color:T.textPri,fontFamily:FM}}>{h.ticker}</span>
          <span style={{fontSize:10,color:T.textDim,fontFamily:FD,marginLeft:6}}>${Number(h.price||0).toFixed(2)}</span>
         </div>
         <div style={{background:bc+"22",color:bc,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:3,border:"1px solid "+bc+"44",letterSpacing:"0.08em"}}>{h.bias==="BULL"?"▲ CALL":"▼ PUT"}</div>
         <div style={{marginLeft:"auto",display:"flex",gap:2,alignItems:"center"}}>
          {["topdown_bias","expansion","in_zone","vol_confirm","liquid"].map(k=>(
           <div key={k} title={k} style={{width:8,height:8,borderRadius:2,background:h.conditions?.[k]?T.sage:T.border2}}/>
          ))}
          <span style={{fontSize:10,fontWeight:700,color:h.met===5?T.sage:h.met>=4?T.gold:T.textDim,marginLeft:5,fontFamily:FM}}>{h.met}/5</span>
         </div>
        </div>
        <div style={{marginBottom:6}}>
         <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
          <span style={{fontSize:8,color:T.textDim,fontFamily:FD}}>Retracement</span>
          <span style={{fontSize:8,color:retrColor,fontFamily:FD,fontWeight:retrPct<=50?700:400}}>{retrPct.toFixed(1)}%{retrPct<=50?" ✓":""}</span>
         </div>
         <div style={{height:4,borderRadius:2,background:T.border2,overflow:"hidden"}}>
          <div style={{height:"100%",width:Math.min(retrPct,100)+"%",background:retrColor,borderRadius:2}}/>
         </div>
         <div style={{display:"flex",justifyContent:"space-between",marginTop:1}}>
          <span style={{fontSize:7,color:T.textDim,fontFamily:FD}}>0%</span>
          <span style={{fontSize:7,color:T.sage,fontFamily:FD}}>50%</span>
          <span style={{fontSize:7,color:T.textDim,fontFamily:FD}}>100%</span>
         </div>
        </div>
        <div style={{fontSize:9,color:T.textSec,fontFamily:FD,fontStyle:"italic"}}>
         {h.bias==="BULL"?"Watching for C2 bullish entry":"Watching for C2 bearish entry"}. Retr {retrPct.toFixed(1)}%{retrPct<=50?" — inside 0–50% zone ✓":" — outside zone, wait"}.
        </div>
        {allSyms.has(h.ticker)&&<div style={{fontSize:8,color:T.gold,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:4}}>★ In Scanner</div>}
       </div>
      );
     };
     return(
      <>
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
       {tracked.length>0&&(
        <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:6,overflow:"hidden",marginBottom:10}}>
         <div style={{padding:"8px 14px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:6,background:T.bg}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:T.gold,flexShrink:0}}/>
          <span style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FM}}>Already Tracked</span>
          <span style={{fontSize:9,color:T.textDim,marginLeft:"auto"}}>Screener confirms open setups</span>
         </div>
         {tracked.map(renderTrackedCard)}
        </div>
       )}
      </>
     );
    })()}
   </>
  )}
 </div>
)}

 {(view==="all"||view==="managing"||view==="everything")&&(
 <div style={{marginTop:6,background:T.surface,border:"1px solid "+T.border,borderRadius:6,overflow:"hidden"}}>
 <button onClick={()=>setFwOpen(p=>!p)} style={{width:"100%",padding:"10px 16px",background:"transparent",border:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
 <span style={{fontSize:9,color:T.textDim,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FM}}>Methodology{!fwOpen?" — Private":""}</span>
 <span style={{fontSize:9,color:T.textDim}}>{fwOpen?"▲":"🔒"}</span>
 </button>
 {fwOpen&&(
 <div style={{padding:"0 16px 12px",fontSize:10,color:T.textSec,lineHeight:2,borderTop:"1px solid "+T.border}}>
 <div style={{marginTop:8}}>Top-down:12M→6M→3M→Monthly→Weekly→Daily · 30-candle lookback</div>
 <div>Opposing candle open = range floor/ceiling · 3-candle swing at 4pm = entry trigger · 9:30 open confirms directional framework</div>
 <div style={{color:T.teal,marginTop:2}}>Weekly profiles: Classic Expansion · Midweek Reversal · Consolidation Reversal · Intraweek Reversal · TGIF · Thursday Counter</div>
 <div style={{color:T.textDim}}>C3 CISD body close = confirmation · IC-CISD (intracandle) = higher conviction · Only protected (relevant) swings = invalidation anchors</div>
 <div>Enter at 0–50% Fib · Extensions = targets · Nest new Fib at each swing</div>
 <div style={{color:T.purple}}>Narrative vs structure divergence = proprietary edge</div>
 <div style={{color:T.rose}}>Expansion → Expansion impossible · Entry lives in the middle phase</div>
 <div style={{color:T.textDim}}>Bias invalidation = potential directional flip — protected swing taken creates opposite opportunity</div>
 <div style={{color:T.textDim,marginTop:4}}>IRA: $200 max (5%) · Individual: $3–5 max (5%)</div>
 </div>
 )}
 </div>
 )}
 <div style={{marginTop:8,textAlign:"center",fontSize:8,color:T.textDim,letterSpacing:"0.08em"}}>★ SAVED SETUPS + CHECKLISTS PERSIST ACROSS SESSIONS</div>
 </div>
 )}
 <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
 </div>
 );
}
