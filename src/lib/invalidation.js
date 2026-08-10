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
if (!thresholds || price==null) return {breached:false, thresholds:null};
for (const t of thresholds) {
if (t.direction==="below" && price < t.price) return {breached:true, threshold:t};
if (t.direction==="above" && price > t.price) return {breached:true, threshold:t};
}
return {breached:false, thresholds};
}
