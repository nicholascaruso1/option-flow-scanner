import sys
PATH = "src/App.jsx"
with open(PATH) as f:
    src = f.read()
errors = []

A1 = 'const [openScreenerRows, setOpenScreenerRows] = useState({});'
B1 = 'const [openScreenerRows, setOpenScreenerRows] = useState({});\nconst [initDone, setInitDone] = useState(false);'
if src.count(A1) != 1: errors.append(f"anchor1 count={src.count(A1)}")
else: src = src.replace(A1, B1)

A2 = 'const [f,c,t,ai,mem,c1d,jnl,pfc] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_c123",{}),ls("of_journal",{}),ls("of_preflight",{})]);'
B2 = 'const [f,c,t,ai,mem,c1d,jnl,pfc,ac] = await Promise.all([ls("of_favs",[]),ls("of_checks",{}),ls("of_ts",null),ls("of_ai_updates",{}),ls("of_memory",{}),ls("of_c123",{}),ls("of_journal",{}),ls("of_preflight",{}),ls("of_ai_cards",{})]);'
if src.count(A2) != 1: errors.append(f"anchor2 count={src.count(A2)}")
else: src = src.replace(A2, B2)

A3 = 'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setC123(c1d||{}); setJournalNotes(jnl||{}); setPfChecks(pfc||{});'
B3 = 'setFavs(f); setChecks(c); setTs(t||AS_OF); setAiUpdates(ai||{}); setMemoryData(mem||{}); setC123(c1d||{}); setJournalNotes(jnl||{}); setPfChecks(pfc||{});\nsetAiCards(ac||{}); setInitDone(true);'
if src.count(A3) != 1: errors.append(f"anchor3 count={src.count(A3)}")
else: src = src.replace(A3, B3)

A4 = '\nuseEffect(()=>{(async()=>{const ac=await ls("of_ai_cards",{});setAiCards(ac||{});})();},[]);'
if src.count(A4) != 1: errors.append(f"anchor4 count={src.count(A4)}")
else: src = src.replace(A4, '')

A5 = 'useEffect(() => { _doRefreshRef.current?.(); }, []);'
B5 = 'useEffect(() => { if (initDone) _doRefreshRef.current?.(); }, [initDone]);'
if src.count(A5) != 1: errors.append(f"anchor5 count={src.count(A5)}")
else: src = src.replace(A5, B5)

if errors:
    print("FAILED:"); [print(" ",e) for e in errors]; sys.exit(1)
with open(PATH,"w") as f: f.write(src)
print("✓ patch_fix_init_timing applied")
