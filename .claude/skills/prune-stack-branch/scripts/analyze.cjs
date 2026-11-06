// Usage: node analyze.cjs out.json  → writes removable line ranges (fixpoint: code used only by removed code is removed too)
const { ts, ls, prog, root, rel, inDirs, liveFiles, candidates } = require("./lib.cjs");
const live = liveFiles(); const cands = candidates();
const key = (c) => c.file + ":" + c.start; const removed = new Set();
const byFile = {}; for (const c of cands) (byFile[c.file] ??= []).push(c);
// string-literal indexed access (`T['name']`) isn't returned by findReferences → count textual matches as reads
const lit = {};
for (const sf of prog.getSourceFiles()) { if (sf.fileName.includes("node_modules")) continue;
  for (const x of sf.text.matchAll(/\[\s*["']([\w-]+)["']\s*\]/g)) (lit[x[1]] ??= []).push({ fileName: sf.fileName, textSpan: { start: x.index } }); }
function findNode(sf, pos) { let res; (function w(n) { if (n.getStart(sf) <= pos && pos < n.getEnd()) { res = n; ts.forEachChild(n, w); } })(sf); return res; }
const cache = new Map();
function classify(c) { const k = key(c); if (cache.has(k)) return cache.get(k);
  const reads = [], writes = [];
  for (const r of (ls.getReferencesAtPosition(c.file, c.nameNode.getStart()) || []).filter((r) => !r.isDefinition)) {
    const sf = prog.getSourceFile(r.fileName), n = findNode(sf, r.textSpan.start), p = n && n.parent;
    // `this.x = ...;` statements only write the member → they go away together with it
    if (p && ts.isPropertyAccessExpression(p) && p.name === n && ts.isBinaryExpression(p.parent) && p.parent.left === p &&
        p.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isExpressionStatement(p.parent.parent) && p.expression.kind === ts.SyntaxKind.ThisKeyword) {
      const st = p.parent.parent, t = sf.text; let s = st.getStart(sf); while (s > 0 && t[s - 1] !== "\n") s--; let e = st.getEnd(); if (t[e] === "\n") e++;
      writes.push({ fileName: r.fileName, start: s, end: e });
    } else reads.push(r);
  }
  if (lit[c.nameNode.text]) reads.push(...lit[c.nameNode.text]);
  const v = { reads, writes }; cache.set(k, v); return v; }
const inRemoved = (f, pos) => (byFile[f] || []).some((c) => removed.has(key(c)) && pos >= c.start && pos < c.end);
for (let changed = true; changed;) { changed = false;
  for (const c of cands) { if (removed.has(key(c))) continue;
    const used = classify(c).reads.some((r) => {
      if (!inDirs(r.fileName)) return live.has(rel(r.fileName));       // outside refs only count if that file is itself live
      if (inRemoved(r.fileName, r.textSpan.start)) return false;
      if (r.fileName === c.file && r.textSpan.start >= c.start && r.textSpan.start < c.end) return false; // self-recursion
      return true; });
    if (!used) { removed.add(key(c)); changed = true; } } }
const out = [];
for (const c of cands) if (removed.has(key(c))) { out.push({ file: c.file, start: c.start, end: c.end, label: c.label }); for (const w of classify(c).writes) out.push({ file: w.fileName, start: w.start, end: w.end, label: "write " + c.label }); }
require("fs").writeFileSync(process.argv[2], JSON.stringify(out));
console.log(`candidates ${cands.length}, removable ${removed.size}`);
