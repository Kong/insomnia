// Removes now-unused IMPORTS only (never params/locals — dropping unused ctor params would change signatures).
const { ls, prog, fs, inDirs } = require("./lib.cjs");
for (const sf of prog.getSourceFiles()) { if (!inDirs(sf.fileName)) continue;
  const d = ls.getSemanticDiagnostics(sf.fileName).concat(ls.getSuggestionDiagnostics(sf.fileName)).filter((x) => [6133, 6192, 6196, 6198].includes(x.code));
  if (!d.length) continue;
  for (const ch of ls.getCombinedCodeFix({ type: "file", fileName: sf.fileName }, "unusedIdentifier_deleteImports", {}, {}).changes) {
    let t = fs.readFileSync(ch.fileName, "utf8"); for (const tc of [...ch.textChanges].sort((a, b) => b.span.start - a.span.start)) t = t.slice(0, tc.span.start) + tc.newText + t.slice(tc.span.start + tc.span.length);
    fs.writeFileSync(ch.fileName, t); } }
