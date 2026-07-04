#!/usr/bin/env python3
"""
Patch: Auto-trigger live data on page load
- Adds useRef to import
- Adds on-mount doRefresh call using useRef pattern (avoids infinite loop)
"""
import re, sys

SRC = "/Users/nick/option-flow-scanner/src/App.jsx"

with open(SRC, "r", encoding="utf-8") as f:
    code = f.read()

# ── 1. Add useRef to import ──────────────────────────────────────────────────
OLD_IMPORT = 'import { useState, useEffect, useCallback } from "react";'
NEW_IMPORT = 'import { useState, useEffect, useCallback, useRef } from "react";'

if NEW_IMPORT in code:
    print("✓ useRef already imported — skipping")
elif OLD_IMPORT not in code:
    print("✗ Could not find import line — aborting"); sys.exit(1)
else:
    code = code.replace(OLD_IMPORT, NEW_IMPORT, 1)
    print("✓ Added useRef to import")

# ── 2. Insert on-mount effect after the 15-min interval effect ───────────────
ANCHOR = """ }, [doRefresh]);
 const toggleFav"""

INSERT = """ }, [doRefresh]);
 // Fire live data refresh once on mount (useRef avoids infinite-loop from dep array)
 const _doRefreshRef = useRef(null);
 useEffect(() => { _doRefreshRef.current = doRefresh; }, [doRefresh]);
 useEffect(() => { _doRefreshRef.current?.(); }, []);
 const toggleFav"""

if " _doRefreshRef" in code:
    print("✓ Mount effect already present — skipping")
elif ANCHOR not in code:
    print("✗ Could not find anchor — aborting"); sys.exit(1)
else:
    code = code.replace(ANCHOR, INSERT, 1)
    print("✓ Inserted on-mount doRefresh effect")

with open(SRC, "w", encoding="utf-8") as f:
    f.write(code)

print("\nDone. Verify with:")
print("  grep -n '_doRefreshRef\\|useRef' ~/option-flow-scanner/src/App.jsx")
