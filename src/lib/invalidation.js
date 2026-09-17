export function parseInvalidation(invalidationStr) {
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

export function checkInvalidation(setup, price) {
const thresholds = parseInvalidation(setup.invalidation);
// Always return the same shape: `threshold` is the single breached one (or
// null), `thresholds` is always the full parsed array (or null). Previously
// the no-breach branches returned only `thresholds` and the breach branch
// returned only `threshold` — harmless today since every call site reads
// `.threshold` guarded by `.breached===true`, but a landmine for the next
// caller that doesn't know which branch sets which key.
if (!thresholds || price==null) return {breached:false, threshold:null, thresholds:null};
for (const t of thresholds) {
if (t.direction==="below" && price < t.price) return {breached:true, threshold:t, thresholds};
if (t.direction==="above" && price > t.price) return {breached:true, threshold:t, thresholds};
}
return {breached:false, threshold:null, thresholds};
}
