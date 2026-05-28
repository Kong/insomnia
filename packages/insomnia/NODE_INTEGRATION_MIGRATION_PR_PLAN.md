# Node Integration Migration PR Plan

This document tracks the renderer `nodeIntegration: false` migration. The original PR-by-PR plan in this file was written when the baseline contained ~30 entries and many subsystems still owned filesystem and crypto code in renderer-reachable modules. Most of those candidates have since landed via other workstreams. This refresh reflects the actual current state of `packages/insomnia/src/`.

## Goal

Flip the main BrowserWindow in `src/main/window-utils.ts:199-208` from `nodeIntegration: true` to `nodeIntegration: false`. Phase 2 (later) flips `contextIsolation: false` to `true`. The hidden BrowserWindow keeps `nodeIntegration: true` for plugin and script execution.

## Guardrails (already in place)

- Renderer import analyzer in `vite.config.ts`
- Baseline comparison in `scripts/check-renderer-node-imports.ts`
- Baseline snapshot in `config/renderer-node-import-baseline.json`
- CI via `npm run check:renderer-node-imports`

Note: both `config/renderer-node-import-baseline.json` and `.reports/renderer-node-imports.json` are stale relative to the working tree. Run `npm run update:renderer-node-import-baseline` before opening the next PR.

## What is actually left (verified against current code)

Seven files in `packages/insomnia/src/` still import Node builtins:

| File | Builtins | Notes |
|---|---|---|
| `src/plugins/index.ts` | `fs`, `path` | Plugin discovery |
| `src/plugins/create.ts` | `fs`, `path` | Plugin filesystem writes |
| `src/plugins/context/response.ts` | `fs`, `zlib`, `stream` (type only) | Plugin response API |
| `src/utils/plugin.ts` | `fs`, `path` | Plugin helpers |
| `src/network/network.ts` | `fs`, `path` | Request execution pipeline |
| `src/script-executor.ts` | `fs/promises` | Script execution file IO |
| `src/templating/base-extension.ts` | `crypto`, `os` | Templating bootstrap |

Plus two carve-out modules under `packages/insomnia-testing/src/` (`generate/generate.ts`, `run/run.ts`) which the analyzer counts but which are not loaded by the renderer at runtime — they ship with the CLI.

## Already completed since the original plan

No follow-up action needed for any of these:

- PRs 1–3 of the original plan (route path/fs cleanup, shared helper cleanup) — merged
- Response archival — `response-operations.ts` migrated to `insomnia-data/node-src/`
- `src/network/url-matches-cert-host.ts` — cleaned
- `src/scripting/require-interceptor.ts` — cleaned
- OAuth token crypto — files moved out of renderer-reachable paths
- Sync storage / VCS — moved to main / `insomnia-data`
- gRPC `proto-directory-loader.tsx` — moved (only `write-proto-file.ts` still lives in `src/network/grpc/`; verify before assuming clean)
- Import parsing (`src/common/import.ts`) — cleaned
- Plugin execution (Phase 1a of the plugin POC) — PR #9889 plus follow-ups; all plugin invocations now cross an IPC bridge to a hidden BrowserWindow

## Remaining PRs

### PR A: Plugins (largest cluster)

Files: `src/plugins/index.ts`, `src/plugins/create.ts`, `src/plugins/context/response.ts`, `src/utils/plugin.ts`.

This is Phase 1b of the plugin POC (`PLUGIN_SYSTEM_POC.md`). Phase 1a already routes plugin *execution* through `window.main.plugins.*` IPC into a hidden BrowserWindow. Phase 1b moves plugin *discovery, loading, and the response context helper* fully into that hidden window so the renderer holds only metadata and bridge proxies. Re-use the existing `window.main.plugins.*` channel surface; do not invent a parallel discovery bridge.

Risk: high. Longest renderer code path that survived the earlier cleanup.

Suggested reviewers: Plugins/templating, Electron/runtime.

### PR B: `src/network/network.ts`

Last network offender. Two options:

1. Lift `fs` / `path` use to a narrow main-side helper (`writeMultipartBody`, `resolveBodyFilePath`, etc.) exposed via existing `window.main` surface.
2. Or finish the pipeline-to-main move: push `sendCurlAndWriteTimeline`, `tryToInterpolateRequest`, and `tryToExecute*Script` into main and let the renderer call a single `window.main.executeRequest`. Cleaner endpoint, much larger PR.

Recommendation: do option 1 to unblock the flag flip; defer option 2 to post-flip cleanup.

Risk: medium.

Suggested reviewers: Network/gRPC, Electron/runtime.

### PR C: `src/script-executor.ts`

One `appendFile` from `node:fs/promises`. Move the file-write behind an existing or new narrow `window.main.scriptLog.append` bridge. Keep the rest of script orchestration in place.

Risk: low.

Suggested reviewers: Plugins/templating, Electron/runtime.

### PR D: `src/templating/base-extension.ts`

Replace `crypto` hashing with Web Crypto (`crypto.subtle`) where the algorithm allows, or expose a `window.main.hash` helper for legacy algorithms. Replace `os.hostname()` / `os.userInfo()` with values fetched once from main on startup and cached in renderer.

Risk: low.

Suggested reviewers: Plugins/templating, Electron/runtime.

### PR E: inso carve-out

Decide between:

(a) adding `packages/insomnia-testing` to the analyzer's allow-list — it never runs in the renderer; or
(b) restructuring the package so the renderer-imported entrypoint does not transitively pull `run.ts` / `generate.ts`.

Option (a) is simpler and matches reality.

Risk: low.

Suggested reviewers: Electron/runtime, repo maintainers.

## The flip

After PRs A–E land and the baseline file is empty (or reduced to intentionally allowed entries):

- **File:** `src/main/window-utils.ts:199-208`
- **Change:** `nodeIntegration: true` → `false`. Leave `contextIsolation: false` for now (Phase 2). Keep `nodeIntegrationInWorker: false` (already correct — protects the Nunjucks worker sandbox). Hidden window stays on `nodeIntegration: true`.
- **Audit:** any preload surface added during the migration, particularly anything that writes to disk on behalf of the renderer (e.g. `writeResponseBodyToFile`).

## Verification

- After each offender-removing PR: re-run `npm run update:renderer-node-import-baseline`, confirm the baseline shrinks, and commit the refreshed JSON in the same PR.
- Per-PR: `npm run lint`, `npm run type-check`, `npm test`.
- Before the flag flip: full smoke run (`npm run test:smoke:dev`) covering plugin load, send-request, gRPC, OAuth, scripting, templating.
- After the flag flip: in a dev build, confirm `typeof process === 'undefined'` (or `process.type === undefined`) in the main renderer DevTools console, and that the hidden window still has full Node access. Re-run smoke.

## Exit criteria

1. The analyzer report contains no renderer Node builtin imports outside explicit allow-list entries.
2. `config/renderer-node-import-baseline.json` is empty or only contains intentionally permitted entries.
3. The main BrowserWindow runs with `nodeIntegration: false` without renderer regressions.
4. Security audit of any new preload surface introduced during the migration is complete.
5. Stretch follow-up: tighten `vite.config.ts` to fail rather than baseline; remove the baseline file entirely.
