#!/usr/bin/env bash
# Linearise a PR stack on top of a (changed) base branch while keeping every downstream branch's FINAL TREE unchanged.
# Usage: restack.sh <base-branch> <branch2> <branch3> ...   (branches in stack order; base = the branch you just edited)
# For each branch: replay its own non-merge commits (old-parent..old-self, local tips) onto the new parent with
# `-X theirs`, then add one "align" commit that fixes the tree. Clean (tracked) worktree required.
# MODE (env):  keep  (default) → final tree = the branch's previous tree (use after PRUNING the base: moved-out code stays downstream)
#              carry          → final tree = 3-way merge(base=old parent, ours=old branch tree, theirs=new parent)
#                               (use when the base branch gained NEW commits, e.g. someone pushed a refactor: downstream keeps
#                                its content AND picks up the base's new changes). Stops on conflicts.
set -u
base=$1; shift
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "dirty worktree"; exit 1; }
start=$(git branch --show-current)
prevnew=$base
for b in "$@"; do git branch -f "backup/$b" "$b"; done
oldprev=$(git rev-parse "$base"~0)   # NOTE: pass the OLD tip of base via OLD_BASE if base itself was just amended
[ -n "${OLD_BASE:-}" ] && oldprev=$OLD_BASE
for b in "$@"; do
  old=backup/$b
  git checkout -q -B restack/tmp "$prevnew"
  for c in $(git rev-list --reverse --no-merges "$oldprev..$old"); do
    if ! git cherry-pick --allow-empty --keep-redundant-commits -X theirs "$c" >/dev/null 2>&1; then
      git add -A >/dev/null 2>&1
      if git diff --cached --quiet; then git cherry-pick --skip >/dev/null 2>&1 || git cherry-pick --abort; else GIT_EDITOR=true git cherry-pick --continue >/dev/null 2>&1; fi
    fi
  done
  if [ "${MODE:-keep}" = carry ]; then
    # old parent = the old tip of the previous branch (OLD_BASE for the first one, else backup/<prev>)
    out=$(git merge-tree --write-tree --merge-base="$oldprev" "$old" "$prevnew"); rc=$?
    tree=$(echo "$out" | head -1)
    if [ $rc -ne 0 ]; then   # conflicts: check out the marker tree, run $RESOLVE (shell cmd that fixes the files), stage, continue
      echo "$b: conflicts in: $(echo "$out" | grep -E '^CONFLICT' | sed 's/.*Merge conflict in //' | tr '\n' ' ')"
      [ -n "${RESOLVE:-}" ] || { echo "set RESOLVE='<cmd that fixes conflicted files>' and re-run"; git checkout -q -f "$start"; exit 1; }
      git read-tree --reset -u "$tree"; OLD_REF="$old" bash -c "$RESOLVE"
      git grep -lE '^(<<<<<<<|>>>>>>>) ' -- . >/dev/null 2>&1 && git grep -lE '^(<<<<<<<|>>>>>>>) ' -- . | grep -v '^\.claude/' && { echo "markers remain"; git checkout -q -f "$start"; exit 1; }
      git add -A -- . ':!.claude'; tree=$(git write-tree)
    fi
  else tree=$(git rev-parse "$old^{tree}"); fi
  git read-tree --reset -u "$tree"
  git diff --cached --quiet || git commit -q -m "chore: align $b with updated base branch"
  [ "$(git rev-parse 'HEAD^{tree}')" = "$tree" ] && echo "$b: ok ($(git rev-list --count "$prevnew..HEAD") commits)" || echo "$b: TREE MISMATCH"
  git branch -f "$b" HEAD; oldprev=$old; prevnew=$b
done
git checkout -q "$start"; git branch -D restack/tmp -q
echo "backups kept as backup/*; delete with: git branch --list 'backup/*' | xargs git branch -D"
