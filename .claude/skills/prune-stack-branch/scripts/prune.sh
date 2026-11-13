#!/usr/bin/env bash
# Run from the package root on the branch being pruned. Iterates analyze→apply→imports→delete unreferenced files until stable.
# Then you must run: tsc --noEmit, eslint on changed files, review `git diff --stat`, commit.
set -eu
D="$(cd "$(dirname "$0")" && pwd)"; export NODE_PATH="$(git rev-parse --show-toplevel)/node_modules:$D"
for i in 1 2 3 4 5; do
  node "$D/analyze.cjs" /tmp/prune-ranges.json
  node "$D/apply.cjs" /tmp/prune-ranges.json
  node "$D/imports.cjs" >/dev/null
  L=$(node "$D/unreferenced-files.cjs"); [ -n "$L" ] && echo "$L" | tee -a /tmp/prune-removed-files.txt | xargs git rm -qf
  [ "$(node -e "console.log(require('/tmp/prune-ranges.json').length)")" = 0 ] && [ -z "$L" ] && break
done
bash "$D/tidy-blank-lines.sh"
echo "empty classes (remove file + registry entry if EMPTY and not inheriting):"; node "$D/empty-classes.cjs" || true
