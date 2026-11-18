---
name: prune-stack-branch
description: Slim down one branch of a PR stack (e.g. test/e2e-1-framework of the insomnia-test e2e stack) by finding code that none of THAT branch's tests use — down to class-member / function level — moving it to the downstream branch that needs it, and re-stacking all downstream branches. Use when a stacked PR is too big, when asked to "keep only code used by this branch's tests", "move unused code to the next branch", or "rebase the stack".
---

# Prune a stack branch, push the leftovers downstream, re-stack

Context this was built for: `packages/insomnia-test` (Playwright e2e). Stack (full branch names, in order): `test/e2e-1-framework → test/e2e-2-http-cookie-env → test/e2e-3-protocols → test/e2e-4-workspace → test/e2e-5-sync → test/e2e-6-data → test/refactor_e2e_tests`. `test/refactor_e2e_tests` is the top of the stack and is part of it: always include it as the last argument to `restack.sh` and in the checks/push steps below.
Branch N must contain only the page-object / flow / model / component / enum code that **its own `tests/` actually reach**; everything else lives in the first downstream branch (default: the next one), which keeps the full, original content.

## Ground rules (agreed with the user)
- Only the helper dirs (default `components enums flows models pages`) — NOT `misc/` or other infra, unless told. Mention orphan misc files, don't touch them.
- Granularity is **function/member level**, not file level. A class with no members left is removed wholesale (file + registry entry).
- Everything left in the pruned branch must be meaningful: no empty classes, no orphan imports, no blank-line debris.
- Downstream branches keep their **final tree unchanged** (they already contain what the pruned code needs). Never lose code: removed code must exist in the destination branch.
- Pushing rewritten history = force push → never do it unasked; the user runs/approves `git push --force-with-lease`.

## Workflow
Work from the repo root; clean worktree; `export NODE_PATH=$(pwd)/node_modules:<skill>/scripts`.

1. **Record the old tip**: `git rev-parse HEAD` of the branch to prune (needed as `OLD_BASE` later) and of the original/first version (the destination branch must end up with that full content).
2. **Prune** (in the package dir, e.g. `packages/insomnia-test`):
   `PRUNE_DIRS=components,enums,flows,models,pages bash .claude/skills/prune-stack-branch/scripts/prune.sh`
   - Roots = `tests/**`, `playwright.config.ts`, and files named in package.json/config. Anything in those dirs reachable only from removed code or from non-live files (orphan `misc/*`) is removed too (fixpoint).
   - Reference detection uses the TS language service (`findReferences`) + textual `['name']` indexed-type refs. `this.x = …` writes don't count as use.
   - Enum members, lookup tables (`Record<…>` label maps, `METHOD_LABELS`-style) and constructor params are **not** pruned automatically — they're read by dynamic key, so call them out to the user instead.
   - Registry objects (`pageRegistry`, `flowRegistry`, override with `PRUNE_REGISTRIES`): entries with no consumer are dropped, which orphans whole page/flow files → deleted by the loop.
3. **Handle leftovers manually**: `empty-classes.cjs` output — delete `EMPTY` non-inheriting classes (file + registry entry + imports); union types such as `HttpRequest | GraphQLRequest | …` that mention models only present for other protocols must be narrowed by hand (tsc then shows what's left), then re-run `prune.sh` so the now-unreferenced model files go.
4. **Verify**: `npx tsc --noEmit`, `npx eslint $(git diff HEAD --name-only --diff-filter=M --relative)`, `git diff HEAD -U0 | grep '^+[^+]'` should show only trimmed import lines / narrowed unions. (Repo prettier config doesn't match the files — don't run `prettier --write`.)
5. **Commit** on the pruned branch (Co-Authored-By trailer per session attribution).
6. **Re-stack**: `OLD_BASE=<old tip from step 1> bash .claude/skills/prune-stack-branch/scripts/restack.sh <pruned-branch> <next> <next2> … test/refactor_e2e_tests`
   - Replays each downstream branch's own non-merge commits onto the new parent (`-X theirs`), then one "align" commit restores that branch's previous tree. Script prints `ok`/`TREE MISMATCH` per branch; all must be ok.
   - Because trees are preserved, the code removed from the pruned branch is automatically present in the next branch (it already had the full code). If the user wants the moved-out code to live in a *specific* branch that doesn't have it yet, add it there with `git checkout <full-tip> -- <paths>` **before** step 6 and commit.
   - Moving whole test dirs between branches (e.g. `tests/document` → e4): delete them on the pruned branch, then in the destination branch make sure they exist (they usually already do) and that branches in between don't (merge/delete them there), before re-stacking.
   - If you see transient `index.lock` errors at the end of the script, check `git status` / branch checks below; they were harmless in practice (IDE git).
7. **Check**: for each branch `git merge-base --is-ancestor <prev> <branch>`, `git rev-list --merges --count <prev>..<branch>` = 0, tsc passes on the first and last branch. Delete `backup/*` branches only after the user is happy.
8. **Push** only on request: `git push --force-with-lease origin <branches…>`. Claude's auto-mode classifier blocks force pushes; tell the user and let them run it (or allow it explicitly), then verify with `git fetch` that local == origin for every branch.

## Pitfalls seen
- Restoring "removed" files from an already-pruned intermediate commit leaves the downstream branch missing members → always restore from the ORIGINAL full tip.
- `unusedIdentifier_delete` code-fix also drops unused ctor params; only use `unusedIdentifier_deleteImports`.
- Enum member deletion + lookup tables = tsc errors and silent runtime misses; leave them.
- `findReferences` misses `Collection['lint']` string-indexed types → the textual scan in `analyze.cjs` covers it.
- Don't run `git merge` conflicts through `-X ours` blindly for stack alignment; use restack.sh (tree-preserving) instead.
