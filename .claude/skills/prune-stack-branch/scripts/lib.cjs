// Shared TS language-service setup. Run from the package root (cwd).
// Env: PRUNE_DIRS (comma list of dirs to prune), PRUNE_ROOTS (comma list of
// root path prefixes/files that count as "real users", default "tests/,playwright.config.ts"),
// PRUNE_REGISTRIES (comma list of top-level object consts whose entries may be pruned, default "pageRegistry,flowRegistry").
const ts = require("typescript"), fs = require("fs"), path = require("path"), cp = require("child_process");
const root = process.cwd();
const DIRS = (process.env.PRUNE_DIRS || "components,enums,flows,models,pages").split(",");
const ROOTS = (process.env.PRUNE_ROOTS || "tests/,playwright.config.ts").split(",");
const REGISTRIES = (process.env.PRUNE_REGISTRIES || "pageRegistry,flowRegistry").split(",");
const rel = (f) => path.relative(root, f);
const inDirs = (f) => DIRS.some((d) => f.startsWith(path.join(root, d) + "/"));
const tracked = cp.execSync('git ls-files "*.ts" "*.tsx"').toString().trim().split("\n");
const files = tracked.map((f) => path.join(root, f));
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile).config, ts.sys, root);
const host = {
  getScriptFileNames: () => files, getScriptVersion: () => "1",
  getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, "utf8")) : undefined),
  getCurrentDirectory: () => root, getCompilationSettings: () => ({ ...parsed.options, noUnusedLocals: true }),
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o), fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
};
const ls = ts.createLanguageService(host);
const prog = ls.getProgram();

// file-level import graph; `live` = files reachable from the roots (tests + configs + strings "misc/x.ts" in package.json/config)
function liveFiles() {
  const cfg = { moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root, paths: { "@package/*": ["./*"] }, allowImportingTsExtensions: true };
  const edges = {};
  for (const f of tracked) {
    const info = ts.preProcessFile(fs.readFileSync(f, "utf8"), true, true); edges[f] = [];
    for (const i of info.importedFiles) {
      const r = ts.resolveModuleName(i.fileName, path.join(root, f), cfg, ts.sys).resolvedModule;
      if (r) { const p = rel(r.resolvedFileName); if (tracked.includes(p)) edges[f].push(p); }
    }
  }
  const strRoots = new Set();
  for (const f of ["package.json", "playwright.config.ts", "electron-builder.config.ts", "eslint.config.ts"]) {
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/[\w./-]+\.ts/g)) strRoots.add(m[0].replace(/^\.\//, ""));
  }
  const stack = tracked.filter((f) => ROOTS.some((r) => f.startsWith(r)) || strRoots.has(f));
  const seen = new Set();
  while (stack.length) { const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); stack.push(...(edges[f] || [])); }
  return seen;
}

// candidate declarations inside DIRS (range = whole lines incl. JSDoc and trailing , ; newline)
function candidates() {
  const cands = [];
  const add = (sf, owner, nameNode, label) => {
    const t = sf.text; let s = owner.getStart(sf, true); while (s > 0 && t[s - 1] !== "\n") s--;
    let e = owner.getEnd(); while (e < t.length && (t[e] === " " || t[e] === ";" || t[e] === ",")) e++; if (t[e] === "\n") e++;
    cands.push({ file: sf.fileName, nameNode, label, start: s, end: e });
  };
  for (const sf of prog.getSourceFiles()) {
    if (!inDirs(sf.fileName)) continue;
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isExportAssignment(st)) continue;
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) {
          add(sf, st, d.name, "var " + d.name.text);
          let init = d.initializer; while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
          if (REGISTRIES.includes(d.name.text) && init && ts.isObjectLiteralExpression(init))
            for (const pp of init.properties) if (pp.name && ts.isIdentifier(pp.name)) add(sf, pp, pp.name, "registry " + d.name.text + "." + pp.name.text);
        }
        continue;
      }
      if (!st.name || !ts.isIdentifier(st.name)) continue;
      add(sf, st, st.name, ts.SyntaxKind[st.kind] + " " + st.name.text);
      if (ts.isClassDeclaration(st)) for (const m of st.members) {
        if (ts.isConstructorDeclaration(m) || ts.isClassStaticBlockDeclaration(m) || !m.name) continue;
        if (ts.isIdentifier(m.name) || ts.isPrivateIdentifier(m.name) || ts.isStringLiteral(m.name)) add(sf, m, m.name, "member " + st.name.text + "." + m.name.text);
      }
      if (ts.isInterfaceDeclaration(st)) for (const m of st.members) if (m.name && ts.isIdentifier(m.name)) add(sf, m, m.name, "iface " + st.name.text + "." + m.name.text);
      // NOTE: enum members and lookup-table entries are deliberately NOT candidates (dynamic lookups can't be proven unused).
    }
  }
  return cands;
}
module.exports = { ts, fs, path, ls, prog, root, rel, inDirs, liveFiles, candidates, tracked };
