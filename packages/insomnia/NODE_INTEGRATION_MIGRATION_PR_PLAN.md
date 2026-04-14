# Node Integration Migration PR Plan

This document breaks the renderer `nodeIntegration: false` migration into deliverable slices that can move in parallel without creating excessive merge conflict risk.

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

## Reviewer Lanes

- Electron/runtime: people familiar with preload, IPC, and main process boundaries
- Router/UI: people familiar with route loaders, actions, and UI flows
- Network/gRPC: people familiar with request execution, file access, and gRPC flows
- Sync/storage: people familiar with VCS, project storage, and compression flows
- Plugins/templating: people familiar with plugin loading and templating execution

## Parallelization Summary

Can start immediately in parallel:

- PR 1: Route path-only cleanup
- PR 2: Route fs-backed cleanup
- PR 3: Shared browser-safe helper cleanup

Can start in parallel with the above if staffed separately:

- PR 4: Renderer-to-main boundary extraction

Should usually wait until PR 4 is clear enough to avoid duplicated refactors:

- PR 5: Network and gRPC boundary pass
- PR 6: Sync and storage boundary pass
- PR 7: Plugin and templating boundary pass

## PR Board

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
- PR 4

## PR 2: Route FS-Backed Cleanup

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
- PR 4

## PR 4: Renderer-to-Main Boundary Extraction

Purpose:

- Stop renderer code from pulling `src/main` implementations into the client graph when only pure helpers or types are needed.

Primary files:

- `src/main/importers/importers/curl.ts`
- `src/main/importers/importers/openapi-3.ts`
- `src/main/importers/importers/swagger-2.ts`
- `src/main/network/parse-header-strings.ts`
- `src/main/secure-read-file.ts`

Likely implementation:

- Move pure helper logic into shared modules outside `src/main`.
- Leave privileged code in `src/main`.
- Update renderer imports to target shared modules or types only.

Expected risk: medium

Suggested reviewers:

- Electron/runtime
- Router/UI
- Network/gRPC

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

- none

Concurrent with:

- PR 1
- PR 3

Blocks or informs:

- PR 5

## PR 5: Network and gRPC Privileged Boundary Pass

Purpose:

- Move filesystem and privileged request execution concerns behind explicit APIs instead of direct renderer imports.

Primary files:

- `src/network/network.ts`
- `src/network/grpc/proto-directory-loader.tsx`
- `src/network/grpc/write-proto-file.ts`
- `src/network/o-auth-1/get-token.ts`
- `src/network/o-auth-2/get-token.ts`
- `src/network/o-auth-2/utils.ts`
- `src/network/url-matches-cert-host.ts`
- `src/models/helpers/response-operations.ts`

Likely implementation:

- Separate pure parsing and formatting code from file/crypto operations.
- Push file reads, writes, temp file creation, and request execution details behind `window.main` or a dedicated network bridge.

Expected risk: high

Suggested reviewers:

- Network/gRPC
- Electron/runtime

Baseline entries to remove:

- `src/network/grpc/proto-directory-loader.tsx -> fs`
- `src/network/grpc/proto-directory-loader.tsx -> path`
- `src/network/grpc/write-proto-file.ts -> fs`
- `src/network/grpc/write-proto-file.ts -> os`
- `src/network/grpc/write-proto-file.ts -> path`
- `src/network/network.ts -> fs`
- `src/network/network.ts -> path`
- `src/network/o-auth-1/get-token.ts -> crypto`
- `src/network/o-auth-2/get-token.ts -> crypto`
- `src/network/o-auth-2/get-token.ts -> querystring`
- `src/network/o-auth-2/utils.ts -> crypto`
- `src/network/url-matches-cert-host.ts -> url`
- `src/models/helpers/response-operations.ts -> fs`
- `src/models/helpers/response-operations.ts -> zlib`

Dependencies:

- recommended after PR 4

Concurrent with:

- PR 6
- PR 7

## PR 6: Sync and Storage Boundary Pass

Purpose:

- Isolate local project storage, sync, compression, and file rename flows behind explicit privileged services.

Primary files:

- `src/sync/store/drivers/file-system-driver.ts`
- `src/sync/store/drivers/graceful-rename.ts`
- `src/sync/store/hooks/compress.ts`
- `src/sync/store/index.ts`
- `src/sync/vcs/util.ts`
- `src/sync/vcs/vcs.ts`
- `src/script-executor.ts`

Likely implementation:

- Move filesystem operations and compression into a storage backend boundary.
- Keep renderer-facing sync orchestration on the safe side of that boundary.

Expected risk: high

Suggested reviewers:

- Sync/storage
- Electron/runtime

Baseline entries to remove:

- `src/script-executor.ts -> fs/promises`
- `src/sync/store/drivers/file-system-driver.ts -> fs/promises`
- `src/sync/store/drivers/file-system-driver.ts -> path`
- `src/sync/store/drivers/graceful-rename.ts -> fs/promises`
- `src/sync/store/hooks/compress.ts -> zlib`
- `src/sync/store/index.ts -> path`
- `src/sync/vcs/util.ts -> crypto`
- `src/sync/vcs/vcs.ts -> crypto`
- `src/sync/vcs/vcs.ts -> path`

Dependencies:

- none, though shared boundary patterns from PR 4 help

Concurrent with:

- PR 5
- PR 7

## PR 7: Plugin and Templating Boundary Pass

Purpose:

- Redesign plugin and templating runtime boundaries so privileged module loading and filesystem traversal do not live in renderer-reachable code.

Primary files:

- `src/plugins/context/response.ts`
- `src/plugins/create.ts`
- `src/plugins/index.ts`
- `src/utils/plugin.ts`
- `src/templating/base-extension.ts`

Likely implementation:

- Decide what plugin discovery and loading must remain privileged.
- Extract pure metadata and UI-facing types from runtime loading logic.
- Push filesystem-backed plugin operations behind explicit APIs.

Expected risk: high

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
- `src/templating/base-extension.ts -> crypto`
- `src/templating/base-extension.ts -> os`

Dependencies:

- none, but coordinate if PR 5 touches shared templating execution

Concurrent with:

- PR 5
- PR 6

## PR 8: Baseline Ratchet Follow-Ups

Purpose:

- Keep the baseline moving downward as soon as functional PRs merge.

Primary files:

- `config/renderer-node-import-baseline.json`
- `.reports/renderer-node-imports.json`

Likely implementation:

- Re-run `npm run update:renderer-node-import-baseline` after each offender-removing PR.
- Confirm the baseline only drops entries already removed from the analyzer output.

Expected risk: low

Suggested reviewers:

- whoever reviewed the functional PR

Dependencies:

- any PR that removes offenders

Concurrent with:

- usually folded into the offender-removing PR rather than done separately

## Suggested Merge Order

1. PR 1
2. PR 2
3. PR 3
4. PR 4
5. PR 5
6. PR 6
7. PR 7

Notes:

- PR 1, PR 2, and PR 3 should produce the fastest visible reduction in route and helper debt.
- PR 4 is the best candidate for early architectural work because it reduces follow-on churn in PR 5 through PR 7.
- PR 5 through PR 7 are intentionally split by subsystem so they can be assigned to different owners.

## Ownership Template

For each PR, capture the following in the PR description:

- Purpose
- Files in scope
- Baseline entries expected to be removed
- Any new preload or IPC surface added
- Any deliberate deferrals to later PRs

## Exit Criteria

This migration is complete when:

1. The analyzer report no longer contains renderer Node builtin imports that are not explicitly allowed.
2. The baseline file is empty or reduced to intentionally permitted entries.
3. Lint restrictions can be tightened by removing temporary offender exclusions.
4. The main BrowserWindow runs with `nodeIntegration: false` without renderer regressions.
