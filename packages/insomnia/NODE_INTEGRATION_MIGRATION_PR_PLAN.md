# Node Integration Migration PR Plan

This document breaks the renderer `nodeIntegration: false` migration into deliverable slices that can move in parallel without creating excessive merge conflict risk.

Update: PR 1 through PR 3 are merged. The remaining work is re-scoped around single feature flows instead of broad subsystem buckets so each PR can land with tighter review, clearer ownership, and faster iteration.

The plan assumes the current guardrails are already in place:

- renderer import analyzer in `vite.config.ts`
- baseline comparison in `scripts/check-renderer-node-imports.ts`
- baseline snapshot in `config/renderer-node-import-baseline.json`
- CI enforcement through `npm run check:renderer-node-imports`

## Delivery Rules

1. Each PR should remove baseline entries or add guardrails. It should not add new renderer Node builtin imports.
2. If a PR removes offenders, update `config/renderer-node-import-baseline.json` in the same PR.
3. Prefer moving privileged behavior behind existing preload or `window.main` APIs before inventing new bridge surface.
4. Do not combine route cleanup with subsystem redesign unless the route is blocked on the subsystem boundary.
5. Remaining candidates should stay scoped to one user-visible feature flow or one tightly bounded privileged service.
6. Each PR should carry an explicit test automation plan before implementation starts.
7. If a feature depends on sync or storage behavior, land the sync/storage boundary first instead of mixing the dependency into the same PR.

## Reviewer Lanes

- Electron/runtime: people familiar with preload, IPC, and main process boundaries
- Router/UI: people familiar with route loaders, actions, and UI flows
- Network/gRPC: people familiar with request execution, file access, and gRPC flows
- Sync/storage: people familiar with VCS, project storage, and compression flows
- Plugins/templating: people familiar with plugin loading and templating execution

## Parallelization Summary

Already merged:

- PR 1: Route path-only cleanup
- PR 2: Route fs-backed cleanup
- PR 3: Shared browser-safe helper cleanup

Next PR candidates:

- Candidate: Sync storage boundary foundation
- Candidate: Import parsing and persistence boundary
- Candidate: gRPC proto asset boundary **(quick win candidate)**
- Candidate: Plugin discovery boundary
- Candidate: Templating bootstrap boundary
- Candidate: OAuth token crypto cleanup **(quick win candidate)**
- Candidate: Response archival and compression boundary
- Candidate: Script executor boundary

Dependencies:

- Import depends on sync storage because import creates or updates persisted workspace state.
- Plugin discovery and templating should stay split so one does not become a catch-all runtime PR.
- gRPC proto asset work can likely move ahead once the sync-storage bridge pattern is clear.
- OAuth cleanup looks like the smallest remaining isolated boundary and is a good candidate for a fast iteration.
- Response archival and `script-executor.ts` should stay separate from the feature-scoped candidates unless a later PR proves they are truly part of the same flow.

## Candidate Backlog

## PR 0: Guardrails and Baseline

Status: already in place

Purpose:

- Keep new debt from being introduced while the migration is underway.

Primary files:

- `packages/insomnia/vite.config.ts`
- `packages/insomnia/scripts/check-renderer-node-imports.ts`
- `packages/insomnia/config/renderer-node-import-baseline.json`
- `eslint.config.mjs`
- `.github/workflows/test.yml`

Expected risk: low

Suggested reviewers:

- Electron/runtime
- Repo maintainers

## PR 1: Route Path-Only Cleanup

Status: merged

Purpose:

- Remove route-local `node:path` usage where existing `window.path` is already sufficient.

Primary files:

- `src/routes/import.scan.tsx`
- `src/routes/organization.$organizationId.project.$projectId.workspace.update.tsx`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.tsx`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection.tsx`

Likely implementation:

- Replace `path.basename`, `path.dirname`, `path.join`, and similar calls with `window.path.*`.
- Keep behavior identical.
- Avoid introducing new preload methods.

Expected risk: low

Suggested reviewers:

- Router/UI
- Electron/runtime

Baseline entries to remove:

- `src/routes/import.scan.tsx -> path`
- `src/routes/organization.$organizationId.project.$projectId.workspace.update.tsx -> path`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.tsx -> path`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection.tsx -> path`

Dependencies:

- none beyond PR 0

Concurrent with:

- PR 2
- PR 3
- later dependency-clearing candidate

## PR 2: Route FS-Backed Cleanup

Status: merged

Purpose:

- Remove route-level `node:fs` and remaining `node:path` usage that touches downloads or file reads.

Primary files:

- `src/routes/organization.$organizationId.project.$projectId.workspace.new.tsx`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send.tsx`

Likely implementation:

- Replace file reads and writes with existing `window.main` APIs where possible.
- Reuse `window.path` for path manipulation.
- If a missing bridge is required, keep it minimal and specific.

Expected risk: medium

Suggested reviewers:

- Router/UI
- Electron/runtime
- Network/gRPC for the debug send route

Baseline entries to remove:

- `src/routes/organization.$organizationId.project.$projectId.workspace.new.tsx -> fs`
- `src/routes/organization.$organizationId.project.$projectId.workspace.new.tsx -> path`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send.tsx -> fs`
- `src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send.tsx -> path`

Dependencies:

- may touch preload if a new minimal bridge is needed

Concurrent with:

- PR 1
- PR 3

## PR 3: Shared Browser-Safe Helper Cleanup

Status: merged

Purpose:

- Remove Node builtin usage from helper modules that should be safe to load in the renderer.

Primary files:

- `src/common/misc.ts`
- `src/common/significant-diff-detection.ts`
- `src/utils/url/querystring.ts`

Secondary candidates if they can be made browser-safe without boundary work:

- `src/models/helpers/response-operations.ts`

Likely implementation:

- Replace Node URL and path helpers with browser or shared alternatives where possible.
- If compression remains privileged, split the pure helper from the privileged implementation.

Expected risk: medium

Suggested reviewers:

- Router/UI
- Electron/runtime

Baseline entries to remove:

- `src/common/misc.ts -> path`
- `src/common/misc.ts -> zlib`
- `src/common/significant-diff-detection.ts -> path`
- `src/utils/url/querystring.ts -> url`

Optional stretch target:

- `src/models/helpers/response-operations.ts -> fs`
- `src/models/helpers/response-operations.ts -> zlib`

Dependencies:

- none, unless compression or file IO must be pushed behind a bridge

Concurrent with:

- PR 1
- PR 2
- later dependency-clearing candidate

## Candidate: Sync Storage Boundary Foundation

Status: candidate

Purpose:

- Move local project sync storage so renderer code stops owning filesystem, compression, and VCS-path details.

Single feature scope:

- Local project persistence for sync-backed workspaces.

Primary files:

- `src/sync/store/drivers/file-system-driver.ts`
- `src/sync/store/drivers/graceful-rename.ts`
- `src/sync/store/hooks/compress.ts`
- `src/sync/store/index.ts`
- `src/sync/vcs/util.ts`
- `src/sync/vcs/vcs.ts`
- `src/sync/vcs/create-vcs.ts`

Implementation notes:

- Introduce a narrow storage-oriented bridge for read, write, rename, compression, and VCS-adjacent path work.
- Avoid mixing import, plugin, or network behavior into this PR.
- Move the vcs class entirely to main, simplify it down so its clear what internal state it has, expose its functions over IPC.
- create an event listener in the renderer to handle events from the conflictHandler function passed into vcs.

Expected risk: high

Quick win: no

Suggested reviewers:

- Sync/storage
- Electron/runtime

Baseline entries to remove:

- `src/sync/store/drivers/file-system-driver.ts -> fs/promises`
- `src/sync/store/drivers/file-system-driver.ts -> path`
- `src/sync/store/drivers/graceful-rename.ts -> fs/promises`
- `src/sync/store/hooks/compress.ts -> zlib`
- `src/sync/store/index.ts -> path`
- `src/sync/vcs/util.ts -> crypto`
- `src/sync/vcs/vcs.ts -> crypto`
- `src/sync/vcs/vcs.ts -> path`

Dependencies:

- none

Test automation plan:

- Extend `src/sync/store/hooks/__tests__/compress.test.ts` and related sync store tests to cover the new privileged boundary behavior.
- Add focused unit coverage for any new main-process sync bridge or IPC handlers.
- Add a renderer-side contract test that proves sync store calls delegate through the bridge instead of importing Node-backed code directly.
- Keep smoke coverage limited to one sync-backed roundtrip so this PR stays quick to iterate.

Enables:

- Import parsing and persistence boundary
- gRPC proto asset boundary
- Plugin discovery boundary
- Templating bootstrap boundary

Out of scope:

- import parsing or import persistence
- gRPC proto temp-file handling
- plugin discovery or templating runtime changes

## Candidate: Import Parsing and Persistence Boundary

Status: candidate

Purpose:

- Make import a self-contained feature flow that relies on the sync boundary instead of importing `src/main` helpers or privileged file access into renderer-reachable modules.

Single feature scope:

- Scan, parse, and persist imported resources.

Primary files:

- `src/common/import.ts`
- `src/routes/import.scan.tsx`
- `src/routes/import.resources.tsx`
- `src/ui/components/modals/import-modal/import-modal.tsx`
- `src/main/importers/convert.ts`
- `src/main/importers/importers/curl.ts`
- `src/main/importers/importers/openapi-3.ts`
- `src/main/importers/importers/swagger-2.ts`
- `src/main/network/parse-header-strings.ts`
- `src/main/secure-read-file.ts`

Implementation notes:

- Keep importer execution and privileged file reads behind explicit main-process entrypoints.
- Extract pure importer helpers into shared modules only where they are genuinely renderer-safe.
- Make the import flow consume the sync/storage candidate instead of mixing storage work into this candidate.

Expected risk: high

Quick win: no

Suggested reviewers:

- Router/UI
- Sync/storage
- Electron/runtime

Baseline entries to remove:

- `src/main/importers/importers/curl.ts -> url`
- `src/main/importers/importers/openapi-3.ts -> crypto`
- `src/main/importers/importers/openapi-3.ts -> url`
- `src/main/importers/importers/swagger-2.ts -> crypto`
- `src/main/network/parse-header-strings.ts -> url`
- potentially `src/main/secure-read-file.ts -> fs`
- potentially `src/main/secure-read-file.ts -> os`
- potentially `src/main/secure-read-file.ts -> path`

Dependencies:

- Sync storage boundary foundation

Test automation plan:

- Extend `src/common/__tests__/import.test.ts` to cover scan and persist paths after the boundary cleanup.
- Add route-level coverage for `src/routes/import.scan.tsx` and `src/routes/import.resources.tsx` where the bridge contract changes.
- Keep one UI-level import smoke path for a representative source such as curl or file import.
- Update the renderer-node-import baseline in the same PR once the import offenders are removed.

Enables:

- import follow-up polish, if needed

Out of scope:

- generic OAuth cleanup
- gRPC proto temp files
- plugin loading and templating

## Candidate: gRPC Proto Asset Boundary

Status: candidate

Purpose:

- Isolate the gRPC proto file preparation flow behind a privileged boundary without expanding the PR into broader network or response persistence cleanup.

Single feature scope:

- Preparing proto directories and temp proto files for gRPC request execution.

Primary files:

- `src/network/grpc/proto-directory-loader.tsx`
- `src/network/grpc/write-proto-file.ts`
- any minimal preload or IPC additions needed to support the proto write path

Implementation notes:

- Move proto temp-file creation and path work to main.
- Keep request assembly in the renderer, but remove direct `fs`, `os`, and `path` ownership from the gRPC preparation path.
- Do not mix in generic request execution, OAuth, or response archival work.

Expected risk: medium

Quick win: yes

Suggested reviewers:

- Network/gRPC
- Electron/runtime

Baseline entries to remove:

- `src/network/grpc/proto-directory-loader.tsx -> fs`
- `src/network/grpc/proto-directory-loader.tsx -> path`
- `src/network/grpc/write-proto-file.ts -> fs`
- `src/network/grpc/write-proto-file.ts -> os`
- `src/network/grpc/write-proto-file.ts -> path`

Dependencies:

- Sync storage boundary foundation patterns should be available first

Test automation plan:

- Extend or relocate unit coverage for `write-proto-file` so the privileged file-write path stays directly tested.
- Add a contract test proving the renderer gRPC flow uses the new bridge instead of direct Node imports.
- Keep one gRPC-focused smoke or integration path that confirms proto-backed requests still resolve correctly.

Out of scope:

- OAuth token helpers
- generic network file IO
- response body archival helpers

## Candidate: Plugin Discovery Boundary

Status: candidate

Purpose:

- Move plugin discovery and plugin file access onto a privileged boundary without coupling the work to templating bootstrap or unrelated runtime refactors.

Single feature scope:

- Plugin discovery, metadata loading, and plugin file access.

Primary files:

- `src/plugins/context/response.ts`
- `src/plugins/create.ts`
- `src/plugins/index.ts`
- `src/utils/plugin.ts`
- any preload or IPC additions needed for plugin discovery and metadata handoff

Implementation notes:

- Keep plugin metadata and UI-facing types renderer-safe.
- Move plugin discovery and plugin file traversal to main.
- Avoid adding templating bootstrap, plugin install, package management, or unrelated runtime redesign to this candidate.

Expected risk: high

Quick win: no

Suggested reviewers:

- Plugins/templating
- Electron/runtime

Baseline entries to remove:

- `src/plugins/context/response.ts -> fs`
- `src/plugins/create.ts -> fs`
- `src/plugins/create.ts -> path`
- `src/plugins/index.ts -> fs`
- `src/plugins/index.ts -> path`
- `src/utils/plugin.ts -> fs`
- `src/utils/plugin.ts -> path`

Dependencies:

- Sync storage boundary foundation should land first
- Prefer after import and gRPC candidate patterns are established so plugin work can reuse the same bridge shape

Test automation plan:

- Extend plugin discovery or plugin creation unit tests around the new privileged entrypoints.
- Add a renderer contract test for plugin metadata loading so the UI path remains fast and explicit.
- Keep one plugin-focused smoke path to prove discovery still works end to end.

Out of scope:

- templating bootstrap
- package installation and lifecycle management
- generic network cleanup
- import persistence changes

## Candidate: Templating Bootstrap Boundary

Status: candidate

Purpose:

- Move templating bootstrap helpers off the renderer path without coupling the work to plugin discovery or broader templating redesign.

Single feature scope:

- Templating startup and privileged helper access.

Primary files:

- `src/templating/base-extension.ts`
- any preload or IPC additions needed for templating bootstrap helpers

Implementation notes:

- Keep template evaluation behavior unchanged while moving privileged helper access behind explicit main-process entrypoints.
- Avoid folding plugin discovery or plugin package management into this candidate.
- Prefer to reuse any plugin-side metadata bridge rather than inventing parallel surfaces if the contracts line up cleanly.

Expected risk: medium

Quick win: maybe

Suggested reviewers:

- Plugins/templating
- Electron/runtime

Baseline entries to remove:

- `src/templating/base-extension.ts -> crypto`
- `src/templating/base-extension.ts -> os`

Dependencies:

- Prefer after plugin discovery boundary if templating still relies on shared plugin bootstrap behavior

Test automation plan:

- Extend templating-focused unit tests around the new privileged entrypoints.
- Add a renderer contract test for templating bootstrap helpers.
- Keep one templating smoke path to prove the startup flow still works end to end.

Out of scope:

- plugin discovery
- package installation and lifecycle management
- generic network cleanup

## Candidate: OAuth Token Crypto Cleanup

Status: candidate

Purpose:

- Remove isolated OAuth crypto usage from renderer-reachable code without pulling in unrelated network or storage work.

Single feature scope:

- OAuth token helper crypto operations.

Primary files:

- `src/network/o-auth-1/get-token.ts`
- `src/network/o-auth-2/get-token.ts`
- `src/network/o-auth-2/utils.ts`

Implementation notes:

- Treat this as a small privileged-helper cleanup, not a broad request-execution refactor.
- Prefer a narrow bridge for hashing, PKCE, and token helper crypto rather than a generic network bridge.
- Keep request sending and response handling out of scope.

Expected risk: low to medium

Quick win: yes

Suggested reviewers:

- Network/gRPC
- Electron/runtime

Baseline entries to remove:

- `src/network/o-auth-1/get-token.ts -> crypto`
- `src/network/o-auth-2/get-token.ts -> crypto`
- `src/network/o-auth-2/utils.ts -> crypto`

Dependencies:

- none

Test automation plan:

- Extend OAuth unit tests around PKCE and token helper behavior.
- Add a renderer contract test for any new crypto bridge surface.
- Keep this candidate free of smoke-test expansion unless an existing auth smoke path already covers the flow.

Out of scope:

- generic request execution
- response archival
- import or sync persistence

## Candidate: Response Archival and Compression Boundary

Status: candidate

Purpose:

- Isolate response body archival and compression so renderer-safe helpers stop owning file and compression concerns.

Single feature scope:

- Response archival, file writes, and compression helpers.

Primary files:

- `src/models/helpers/response-operations.ts`

Implementation notes:

- Split pure response metadata shaping from privileged file-write and compression behavior.
- Avoid bundling this candidate with sync compression just because both touch compression.
- Reuse existing preload APIs if they are already close to the needed shape.

Expected risk: medium

Quick win: maybe

Suggested reviewers:

- Network/gRPC
- Electron/runtime

Baseline entries to remove:

- `src/models/helpers/response-operations.ts -> fs`
- `src/models/helpers/response-operations.ts -> zlib`

Dependencies:

- none, though sync-storage patterns may provide a good template

Test automation plan:

- Extend unit tests for response archival helpers around the boundary split.
- Add a renderer contract test for any file-write bridge used by response exports.
- Keep one focused integration path for exporting or persisting a response body.

Out of scope:

- sync store compression
- generic request execution
- plugin or templating work

## Candidate: Script Executor Boundary

Status: candidate

Purpose:

- Move `script-executor.ts` file access behind a privileged boundary without broadening the work into general scripting or plugin changes.

Single feature scope:

- Script execution file access.

Primary files:

- `src/script-executor.ts`

Implementation notes:

- Keep the candidate narrowly focused on the file-access boundary.
- Do not combine this with plugin loading or broader execution-runtime redesign.
- Reuse existing bridge patterns from sync or response file operations where possible.

Expected risk: medium

Quick win: maybe

Suggested reviewers:

- Electron/runtime
- Sync/storage

Baseline entries to remove:

- `src/script-executor.ts -> fs/promises`

Dependencies:

- none

Test automation plan:

- Extend targeted script-executor tests around the file-access boundary.
- Add a renderer contract test if a new bridge surface is introduced.
- Avoid growing this into a smoke-heavy candidate unless an existing script-execution smoke path already exists.

Out of scope:

- plugin runtime redesign
- sync store persistence
- response archival

## Candidate: Baseline Ratchet Follow-Ups

Purpose:

- Keep the baseline moving downward as soon as functional PRs merge.

Primary files:

- `config/renderer-node-import-baseline.json`
- `.reports/renderer-node-imports.json`

Implementation notes:

- Re-run `npm run update:renderer-node-import-baseline` after each offender-removing PR.
- Confirm the baseline only drops entries already removed from the analyzer output.

Expected risk: low

Suggested reviewers:

- whoever reviewed the functional PR

Dependencies:

- any PR that removes offenders

Concurrent with:

- usually folded into the offender-removing PR rather than done separately

## Suggested Candidate Sequencing

1. Sync storage boundary foundation
2. Import parsing and persistence boundary
3. gRPC proto asset boundary
4. Plugin discovery boundary
5. Templating bootstrap boundary
6. OAuth token crypto cleanup
7. Response archival and compression boundary
8. Script executor boundary

Notes:

- PR 1, PR 2, and PR 3 should produce the fastest visible reduction in route and helper debt.
- Sync storage remains the dependency-clearing candidate because import should not move until sync storage is on the privileged side of the boundary.
- gRPC proto asset work and OAuth token crypto cleanup look like the clearest quick-win candidates.
- Plugin discovery and templating are intentionally separate candidates. If they naturally converge later, that should be a conscious decision rather than the default plan.
- If a candidate starts collecting unrelated offenders, split it again instead of broadening it.

## Ownership Template

For each PR, capture the following in the PR description:

- Purpose
- Single feature scope
- Implementation notes
- Files in scope
- Baseline entries expected to be removed
- Test automation plan
- Any new preload or IPC surface added
- Any deliberate deferrals to later PRs

## Exit Criteria

This migration is complete when:

1. The analyzer report no longer contains renderer Node builtin imports that are not explicitly allowed.
2. The baseline file is empty or reduced to intentionally permitted entries.
3. Lint restrictions can be tightened by removing temporary offender exclusions.
4. The main BrowserWindow runs with `nodeIntegration: false` without renderer regressions.
5. Security audit of changes is complete, including the writeResponseBodyToFile preload function.
