// Prints classes with no members besides a constructor (ctor with param-properties is data, reported as "ctor-params")
const ts = require("typescript"), fs = require("fs"), cp = require("child_process");
const dirs = (process.env.PRUNE_DIRS || "components,enums,flows,models,pages").split(",");
for (const f of cp.execSync(`git ls-files ${dirs.join(" ")}`).toString().trim().split("\n")) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), 99, true);
  for (const st of sf.statements) if (ts.isClassDeclaration(st) && !st.members.filter((m) => !ts.isConstructorDeclaration(m)).length)
    console.log(f, st.name?.text, st.members.length ? "ctor-params" : "EMPTY", st.heritageClauses ? "(extends: inherits members, usually keep)" : ""); }
