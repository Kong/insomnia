// Lists class methods under flows/ pages/ components/ whose return type is not void.
// Uses the TypeScript type checker, so inferred return types are caught too.
// Usage (from repo root):  node .claude/skills/void-flow-migration/scripts/scan-non-void.cjs [--public-flows] [--json out.json]
//   (no flag)        summary per layer + per file
//   --public-flows   only PUBLIC methods of flows/ -> the target is an empty list
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "../../../..");
const pkg = path.join(root, "packages/insomnia-test");
const ts = require(require.resolve("typescript", { paths: [root] }));
process.chdir(pkg);

const args = process.argv.slice(2);
const onlyPublicFlows = args.includes("--public-flows");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : undefined;

const cfgPath = ts.findConfigFile(pkg, ts.sys.fileExists, "tsconfig.json");
const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} });
const prog = ts.createProgram(cfg.fileNames, cfg.options);
const tc = prog.getTypeChecker();
const rows = [];
for (const sf of prog.getSourceFiles()) {
  const rel = path.relative(pkg, sf.fileName);
  if (!/^(flows|pages|components)\//.test(rel)) continue;
  const visit = (n) => {
    if (ts.isMethodDeclaration(n) && n.parent && ts.isClassDeclaration(n.parent)) {
      const ret = tc.typeToString(tc.getReturnTypeOfSignature(tc.getSignatureFromDeclaration(n)));
      const inner = ret.replace(/^Promise<(.*)>$/, "$1");
      const priv = !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
      if (inner !== "void" && inner !== "never") {
        rows.push({ rel, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, name: n.name.getText(), ret, priv });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const shown = onlyPublicFlows ? rows.filter((r) => r.rel.startsWith("flows/") && !r.priv) : rows;
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(shown, null, 1));
if (onlyPublicFlows) {
  console.log(shown.length ? shown.map((r) => `${r.rel}:${r.line} ${r.name}(): ${r.ret}`).join("\n") : "OK: no public flow method returns a value");
  process.exit(shown.length ? 1 : 0);
}
const by = {};
for (const r of shown) (by[r.rel] ||= []).push(r);
for (const layer of ["flows", "pages", "components"]) {
  const v = shown.filter((r) => r.rel.startsWith(layer + "/"));
  console.log(`${layer}: ${v.length} non-void (${v.filter((r) => r.priv).length} private)`);
}
for (const f of Object.keys(by).sort()) console.log(`  ${f} ${by[f].length}`);
