// Usage: node apply.cjs ranges.json → deletes the ranges (outermost wins), writes files in place
const fs = require("fs"); const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const by = {};
for (const x of r) (by[x.file] ??= []).push(x);
for (const f in by) { let t = fs.readFileSync(f, "utf8"); const kept = [];
  for (const x of by[f].sort((a, b) => a.start - b.start || b.end - a.end)) { const l = kept[kept.length - 1];
    if (l && x.start >= l.start && x.end <= l.end) continue; if (l && x.start < l.end) { l.end = Math.max(l.end, x.end); continue; } kept.push({ ...x }); }
  for (const x of kept.reverse()) t = t.slice(0, x.start) + t.slice(x.end); fs.writeFileSync(f, t); }
console.log(Object.keys(by).length, "files edited");
