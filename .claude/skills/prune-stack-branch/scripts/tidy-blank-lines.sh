#!/usr/bin/env bash
# Collapse blank-line debris left by deletions, only in files modified vs HEAD: tidy-blank-lines.sh [<git-ref>]
for f in $(git diff ${1:-HEAD} --name-only --diff-filter=M --relative); do
  perl -0pi -e 's/\{\n([ \t]*\n)+/{\n/g; s/\n([ \t]*\n)+([ \t]*\})/\n$2/g; s/\n{3,}/\n\n/g; s/\A\n+//' "$f"; done
