---
name: void-flow-migration
description: 'Make every public Flow method in packages/insomnia-test return Promise<void> (flows only act; reads move to pages) and adapt all specs. Use when (re)applying this refactor after the stack/base PRs changed, when a rebase conflicts with it, or when new flows/specs added upstream must be brought in line.'
argument-hint: 'Optional: which phase to run (scan | flows | specs | verify), or the base branch/PR that changed'
---

# Void-flow migration (packages/insomnia-test)

**Goal:** every PUBLIC method of every class in `flows/*.flow.ts` returns `Promise<void>`. A flow performs UI actions and leaves the UI in a known state; it never hands data back. Anything a spec needs to read is read through a **page / component** (`user.pageManager.*`) or `FlowContext` (`user.flowManager.context.*`).

This is a repeatable, mostly mechanical refactor. It was done once on branch `test/refactor_page_flow` (365 files, all under `packages/insomnia-test`) and is meant to be re-applied if the stack underneath changes. Only `packages/insomnia-test` is ever touched (never `works/insomnia-test`).

## 0. Before anything else: commit it

The first run lived only in the working tree and was lost (a discard command wiped ~365 uncommitted files; no stash/commit existed to recover from). So:

- Commit after **each phase**, ideally as separate commits: `flows+pages`, then one commit per spec directory group. Small scoped commits make a rebase conflict local and replayable.
- Never leave this refactor uncommitted while rebasing/switching branches.
- New worktree? Follow `AGENTS.md` "Worktree Setup" (`fnm use "$(cat .nvmrc)"`, `npm ci`, not `--ignore-scripts`).

## 1. Decision that was made (don't re-litigate)

Literal "everything returns void" is impossible for pages/components (specs need `Locator`s and values to `expect` on), so the scope is **flows only**. For the data flows used to return, the chosen approach is **"move reads to the page/model layer"**:

- Specs build model objects up front (`new Collection(...)`) and pass them in; flows resolve by name/id (`workspacePage.resolveNode` / `requireItemNode`), so models need no `_id`.
- After an action, specs read via pages (`responsePage.get()`, `<x>RequestPage.get()`, ...).
- Rejected alternatives: adding `expect*` methods inside flows (largest change); keeping read-only `get*` flows (leaves "all flows void" false).

Why it is a big change (numbers from the first scan): 513 non-void methods across flows/pages/components; in flows 131 (66 action-like, 65 query-like); 1467 call sites in 340 spec files consume a flow return value. Heaviest: `workspaceFlow.createProject` (302), `createCollection` (263), `httpRequestFlow.create` (149), `send` (99), `httpRequestFlow.get` (48), `mcpClientFlow.create` (40), `gitSyncFlow.getChanges` (39).

## 2. Scan (also the "is it done?" check)

```bash
node .claude/skills/void-flow-migration/scripts/scan-non-void.cjs                # per-layer / per-file counts
node .claude/skills/void-flow-migration/scripts/scan-non-void.cjs --public-flows # exit 0 + "OK" when finished
cd packages/insomnia-test && npx tsc --noEmit -p . 2>&1 | grep -c 'error TS'     # ~6s; baseline must be 0 first
```

The scan uses the type checker, so inferred return types count. Private/protected helpers (e.g. `BaseFlow.assertCreated`) may keep return values and are not reported by `--public-flows`.

## 3. Phase 1 — flows (see `references/flow-rules.md`)

Rules in one breath:
1. Public flow method -> `Promise<void>`, returns nothing.
2. Action methods that returned an entity/response/page: keep actions, drop read-back. Replace an implicit "it exists" check (`assertCreated(await this.get(..))`) with a void check such as `workspace.requireItemNode(...)`. Leave the UI in the same state as before (e.g. `send` ends with the response pane shown).
3. Pure reads (`get*`, `is*`, `read*`, `getChanges`, `getBranches`, `getTools`, `search`, ...): **delete** from the flow. Deleting (not just voiding) is deliberate: a method that is merely changed to void would let `expect(await flow.get())` type-check silently; a deleted one produces a compile error at every call site.
4. Mixed act+read (`fetchOAuth2Tokens`, `runAllTests`, `uploadRuleset`, ...): flow does the action; the read becomes a page method (add one if missing).
5. Update doc comments; record every old -> new in a migration mapping.

Parallelisation that worked (non-overlapping files, 4 agents): `workspace.flow.ts` alone (35 methods); `app/cookie/preferences/certificates/cloud-sync/export/import/organization/template-tag/variable-source/environment/folder`; the six request flows (http, graphql, grpc, web-socket, socket-io, event-stream); `mcp-client/mock-server/git-sync`. Agents share page files, so they must use targeted `Edit`s, never rewrite whole files.

## 4. Phase 2 — specs (see `references/spec-rules.md`)

After phase 1, `tsc` reports ~2.2k errors only under `tests/` (mostly TS2345 "void passed as argument" and TS2339 "property on void"). Fix per test directory, driven by tsc. Grouping that balanced load (errors in brackets): `http-request` (305); `workspace` (287); `git-sync`+`app`+`migration`; `mcp-client`+`plugin`+`preferences`; `environment`+`cookie`; `data`+`document`; `grpc-request`+`graphql-request`; `web-socket-request`+`socket-io-request`+`event-stream-request`; `cloud-sync`+`runner`; `mock-server`+`template-tag`.

Hard rules for spec agents: never weaken an assertion; keep UI-action order (old flows navigated before reading); don't edit `flows/`; report any flow gap instead of working around it.

**Silent trap:** `expect(await flow.someVoidMethod())` and `const x = await flow.voidMethod()` compile fine. After the spec pass always grep for consumed flow results:

```bash
cd packages/insomnia-test && grep -rnE "(=|expect\(|return|\() *await [a-zA-Z.]*Flow\.[a-zA-Z0-9]+\(" tests | head
```

## 5. Old -> new mapping (details in `references/mapping-*.md`)

| Old | New (spec side) |
|---|---|
| `x = await workspaceFlow.createProject/createCollection/createMcpClient/createEnvironment(..)` | build model first, then `await flow.create*(model)` |
| `<req>Flow.create/send/disconnect/sendMessage` results | call flow, then `pageManager.responsePage.get()` |
| `<req>Flow.get(name)` | `workspacePage.findItemNode` -> `openRequestNode` -> `<x>RequestPage.navigate()` -> `<x>RequestPage.get()` (event-stream used `waitForPane()` before; spec side now uses `navigate()`) |
| `*.fetchOAuth2Tokens()` result | flow clicks fetch; read `<page>.auth.getOAuth2Tokens()` |
| `workspaceFlow.generateCode` | `openGenerateCode(..)` then `workspacePage.getGeneratedCode()` |
| `workspaceFlow.getCollectionSpec/getLintState/getTestSuite*` | `openSpec` / `openTests`, then `specPage.getSpecification()` / `getSettledLintState(n)` / `selectTestSuite`, `getUnitTestNames`, `getTestSuiteNames` |
| `workspaceFlow.run` result | `runnerPage.getTestResultCount()` / `getIterationResultsByFilter()` (read right after each run) |
| `workspaceFlow.cloneWithScanReport` | `scanGitProjectClone` -> `projectSettingsPage.getUnknownFieldFiles()/getUnknownFieldsWarningText()` -> `confirmGitProjectClone` |
| `gitSyncFlow.commit*` returns `Commit` | `gitSyncPage.openHistory()` -> `gitHistoryDialogPage.getLatestCommit()` -> `closeHistory()` |
| `gitSyncFlow.getChanges/getBranches` | open dialog -> `getStagedChanges/getUnstagedChanges` or `getLocalBranches/getRemoteBranches` -> close |
| `appFlow.getDataPath/isAlive/getStdoutListenerCount/captureMainProcessLog` | `user.flowManager.context.*` (moved to `FlowContext`/`SessionContext`) |
| `appFlow.restart()` returns `Page` | void; `user.page` is **stale** afterwards — use `pageManager.*` |
| `cloudSyncFlow.mergeBranchResolvingConflicts` | `mergeBranchExpectingConflicts(b)` -> `cloudSyncBranchesDialogPage.getMergeConflictNames()` -> `resolveMergeConflicts(v)` |
| `environmentFlow.get` | `environmentPage.getEnvironmentVariables(name)` (id: `getEnvironmentId`) |
| `templateTagFlow.get` | `templateTagPage.readTag(template)` |
| `variableSourceFlow` readers | `variableSourcePage.readVariableModal/readHoveredVariable/readTooltip/isTooltipVisible/getNavigation` |
| mock-server route reads | `mockServerFlow.openRoute(route)` then `mockServerPage.getOpenRoute()/showUrl()/getHistory()`; `mockServerPage.getRoutePaths()` |

## 6. Gotchas found the first time

- **Sub-environments:** `environmentFlow.link` now defaults `containerName` to `env.name` (right for base envs). A sub-environment model must be built with `containerName = <base env name>`.
- **gRPC `setBody`/`streamMessage`** required `request.id`, which `create` used to return. Fixed in the flow (`resolveRequestId` falls back to the sidebar node `_id`). If specs fail with "request.id is required", that fix was lost.
- **Mock routes** have no returned id: route flows resolve `route.id ?? mockServerPage.findRouteId(route.path)`. After `editRoute`, the spec must update its own model (`route = {...route, ...changes}`).
- **`createBranchExpectingError`** now leaves the Branches modal open; read `gitBranchesDialogPage.getNewBranchError()` then `closeBranchesDialog()`.
- **`uploadRuleset`** with an invalid ruleset leaves the "Invalid Spectral Ruleset" dialog open: `specPage.isInvalidRulesetDialogShown()` then `workspaceFlow.closeDialog()`.
- **`enterVaultKey`** with a bad key now throws `Error(<modal message>)`; specs use `.rejects.toThrow(...)`.
- **While agents edit concurrently,** a syntax error in one file makes the whole `tsc -p .` stop before reporting semantic errors anywhere. Re-run once everyone is done, or check a directory with a temporary tsconfig.
- **Docs go stale:** `packages/insomnia-test/README.md` example and `.claude/skills/write-insomnia-test/SKILL.md` snippets showed `const x = await flow.create(...)`. Update both, or new specs generated from them won't compile.

## 7. Assertions that could not be kept identical (re-check on re-apply)

- `preferences/vault-key-generation.spec.ts`, `vault-key-reset-and-invalid-key.spec.ts`: flows no longer return the key, so it can't be compared with the key shown in the generation modal; now checks non-empty and stable across reopening Preferences.
- `preferences/ai-backend-settings.spec.ts`: `afterDeactivate` is read after deactivating (from the "LLM URL" panel); fails at runtime if that panel clears fields when inactive.
- `environment/variable-source-tooltip-behavior.spec.ts` ("hovering an undefined variable swaps the tooltip"): bypasses `hoverBetweenVariables` and drives `variableSourcePage` directly to keep the "first tooltip contains subenvA0" assertion; that test no longer covers the flow method.
- `data/import-legacy-v5-ids.spec.ts`: rename checks were tautological (compared the returned name to itself); now read from the tree node.
- Pre-existing, untouched: `data/custom-lint-ruleset.spec.ts` compares `{errors, warnings, codes}` against `getSettledLintState`'s `{errors, warnings, entries}` (shape mismatch, hidden by `test.fail`).

## 8. Cleanup worth doing

The first pass left near-duplicate spec helpers (`readHttpRequest` / `openHttpRequest` in http-request, data, workspace, environment, cloud-sync, template-tag; also `openMcpClient`). Consolidating them into one shared helper (e.g. `tests/helpers/`) is optional but recommended.

## 9. Re-applying after the stack changed

1. Rebase first; resolve conflicts in `flows/`, `pages/`, specs by taking the **upstream** version of a conflicting file and re-applying the rules, rather than hand-merging old and new (the change is mechanical and the scan/tsc will tell you what is left).
2. Run the scan; new upstream flow methods or flows show up there. New upstream specs show up as tsc errors.
3. Reuse `references/mapping-*.md` for anything already mapped; add new entries for new methods.
4. Verify (below), commit per phase.

## 10. Verify

```bash
cd packages/insomnia-test
npx tsc --noEmit -p .                    # 0 errors
npx eslint .                             # clean
node ../../.claude/skills/void-flow-migration/scripts/scan-non-void.cjs --public-flows   # OK
```

None of this runs the specs. The Electron e2e must be run locally for the real check, at least these areas: `preferences`, `git-sync`, `mock-server`, `cloud-sync` (merge conflicts), `runner` (delay), `environment` (variable-source tooltip), `grpc-request`. e.g. `npm run test:smoke:dev -- <title-substring>`.
