#!/usr/bin/env python3
"""
patch_pill_hierarchy.py
Line-index based — avoids emoji anchor issues.
Splits main options card pill row into two tiers.
Apply from: ~/option-flow-scanner/
"""

PATH = "/Users/nick/option-flow-scanner/src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

errors = []

# Verify key anchors before touching anything
if "CAP_COLORS[s.capSize]||T.slate" not in lines[1324]:
    errors.append("ABORT: Line 1145 is not the cap size pill line — file may differ from expected.")
if 'display:"flex",gap:8,marginTop:8,paddingBottom:10' not in lines[1347]:
    errors.append("ABORT: Line 1168 is not the metadata strip — file may differ from expected.")

if errors:
    for e in errors: print(e)
    print("File NOT modified.")
    exit(1)

# ── CHANGE 1: metadata strip (lines 1168-1171, 0-indexed 1167-1170)
# Replace 4 lines with 5 lines (add cap size as plain text)
# Do this FIRST since it's below the pill block (keeps pill block indices stable)
OLD_META = lines[1347:1351]
NEW_META = [
    ' <div style={{display:"flex",gap:8,marginTop:8,paddingBottom:10,flexWrap:"wrap",alignItems:"center"}}>\n',
    ' <span style={{fontSize:9,color:T.textDim,fontFamily:FD}}>Vol {dispVol}</span>\n',
    ' <span style={{fontSize:9,color:CAP_COLORS[s.capSize]||T.textDim,fontFamily:FD}}>{s.capSize} \u00b7 {s.mcap}</span>\n',
    ' {s.accountFit.map((a,i)=><span key={i} style={{fontSize:9,color:T.textDim}}>\U0001f4bc {a}</span>)}\n',
    ' </div>\n',
]
lines[1347:1351] = NEW_META
print("\u2713 Change 1: cap size added to metadata strip")

# ── CHANGE 2: pill block (lines 1141-1151, 0-indexed 1140-1150)
# Replace 11 lines with 14 lines (two-tier pill split)
OLD_PILLS = lines[1320:1331]
NEW_PILLS = [
    ' <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>\n',
    ' {invAlert&&<span style={pill(T.rose)}>\u26a0 INVALIDATED</span>}\n',
    ' <span style={pill(ac)}>{ph.icon} {ph.label}</span>\n',
    ' <span style={pill(dc)}>{s.direction==="call"?"Call \u2191":s.direction==="put"?"Put \u2193":"Watch"}</span>\n',
    ' {s.retailTrap&&<span style={pill(T.purple)}>\U0001fa9c Divergence</span>}\n',
    ' {vIdx===0&&!invAlert&&!s.isActive&&view!=="managing"&&<span style={pill(T.teal)}>\u26a1 Top Aligned</span>}\n',
    ' </div>\n',
    ' {(earnD!=null||dteD!=null||allCk.length>0)&&(\n',
    ' <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:5,alignItems:"center"}}>\n',
    ' {allCk.length>0&&<span style={{fontSize:9,color:T.sage,fontFamily:FD}}>\u2713 {allCk.length}/{CHECKLIST.length} checks</span>}\n',
    ' {earnD!=null&&<span style={{fontSize:9,color:earnC,fontFamily:FD}}>Earnings {s.earningsLabel} \u00b7 {earnD}d</span>}\n',
    ' {dteD!=null&&<span style={{fontSize:9,color:dteD<=7?T.rose:T.textDim,fontFamily:FD}}>Exp {dteD}d</span>}\n',
    ' </div>\n',
    ' )}\n',
]
lines[1320:1331] = NEW_PILLS
print("\u2713 Change 2: pill rows split into two tiers")

with open(PATH, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("\n\u2713 All changes applied. File saved.")
print("Next: git add . && git commit -m 'pill hierarchy: two-tier split' && git push && npm run deploy")
