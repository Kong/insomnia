# Node Integration Migration PR Plan

This document tracks the renderer `nodeIntegration: false` migration for the main `BrowserWindow`, and the follow-on work to harden the preload surface before flipping `contextIsolation`.

## Status

**Phase 1 is complete.** `nodeIntegration: false` landed in `src/main/window-utils.ts` (commit `e4f9d8f3b`). The hidden BrowserWindow retains `nodeIntegration: true` for plugin and script execution.

Phase 2 (flip `contextIsolation: false` → `true`) is the next milestone.

---

## What was done (high level)

| Area | Work |
|---|---|
| **Import guardrails** | Renderer import analyzer (`vite.config.ts`), baseline snapshot (`config/renderer-node-import-baseline.json`), CI via `npm run check:renderer-node-imports` |
| **Network / route cleanup** | `response-operations.ts` → `insomnia-data/node-src/`; `url-matches-cert-host.ts`, `require-interceptor.ts`, `import.ts` cleaned |
| **Third-party Node deps** | `mime-types` → `common/mime.ts` (Web API); `iconv-lite` → `TextDecoder`; `tough-cookie` and `@grpc/grpc-js` moved behind IPC |
| **Plugin system** | Phase 1a (PR #9889): all plugin execution IPC-bridged to hidden BrowserWindow; Phase 1b (PR #9998): plugin imports removed from vite renderer bundle |
| **Vault crypto** | `utils/vault-crypto.ts` rewritten as a thin IPC adapter — `encryptSecretValue`/`decryptSecretValue` delegate to `window.main.vault.*` in main (`main/ipc/main.ts:819`) |
| **Env var preload** | `entry.preload.ts` collects all required env vars at preload time and exposes them as `window.env`; `common/constants.ts` reads `window.env` first, falls back to `process.env` for CLI/main |
| **The flag** | `nodeIntegration: true` → `false` in `window-utils.ts` (Phase 1 complete) |

---

## Next steps (Phase 2 pre-work)

Phase 2 goal: flip `contextIsolation: false` → `true`. The preload already branches on `process.contextIsolated` to use `contextBridge.exposeInMainWorld` — but several surface areas need a second pass before that branch is exercised in production.

### PR F: Vault adapter — move crypto to renderer (Web Crypto)

Current state: `vault-crypto.ts` is an IPC passthrough to `window.main.vault.*`. Every encrypt/decrypt call crosses the IPC boundary, adding latency and coupling.

Proposed: replace the IPC delegation with a pure Web Crypto (`crypto.subtle`) implementation directly in the renderer. AES-GCM is natively available; the key material (`JsonWebKey`) already lives in the renderer. The IPC handlers in `main/ipc/main.ts:819-822` and the `vault.encryptSecretValue` / `vault.decryptSecretValue` entries in `main/ipc/electron.ts:175-176` can be removed once this lands.

This also removes a privileged write-capable IPC channel from the preload surface, which is a security win ahead of the contextIsolation flip.

Risk: medium — touch vault key derivation and encrypt/decrypt paths; needs test coverage for the Web Crypto implementation.

### PR G: Second pass — preloaded env variables

Current state: `entry.preload.ts` snapshots all env vars at preload time and exposes them as `window.env`. `common/constants.ts` reads `window.env` with a `process.env` fallback. This works today because `contextIsolation: false` means the `else` branch (`window.env = env`) is taken.

Issues to address before the contextIsolation flip:

1. **`src/insomnia-data/src/models/settings.ts:25`** — reads `process.env.PLAYWRIGHT_TEST` directly. Will be `undefined` (or throw) in a context-isolated renderer. Should read from `window.env.PLAYWRIGHT_TEST` or receive the value via a model initialisation argument.
2. **`constants.ts` fallback** — the `process[ENV]` fallback is intentional for the CLI, but in the renderer it should be a hard read from `window.env` (no fallback) so misconfiguration fails loudly rather than silently reading stale process env.
3. **`entry.preload.ts` surface audit** — review which env vars are actually needed by the renderer vs. the preload vs. the CLI, and drop anything not required from `window.env` (principle of least privilege).
4. **`plugins/index.ts:207,214`** — uses `process.env['HOME']` and `process.env['INSOMNIA_DATA_PATH']`. These run inside the hidden BrowserWindow which keeps `nodeIntegration: true`, so they are safe, but worth annotating explicitly.

Risk: low–medium. Mostly mechanical; risky only if any env var read is missed.

---

## Still outstanding (pre-Phase-2)

These were scoped out of the Phase 1 PRs and are still needed before the contextIsolation flip:

| Item | Notes |
|---|---|
| `src/plugins/index.ts`, `src/plugins/create.ts`, `src/utils/plugin.ts` | Still import `fs`/`path`. Safe for now (run in hidden window), but the import baseline should reflect that explicitly. |
| `src/plugins/context/response.ts` | `fs`, `zlib`, `stream` — same as above. |
| `src/network/network.ts` | `fs`/`path` for multipart body and cert resolution. Candidate for a narrow `window.main` helper or deferral to post-Phase-2 cleanup. |
| `src/script-executor.ts` | One `appendFile` (`node:fs/promises`). Move behind `window.main.scriptLog.append` bridge. |
| `src/templating/base-extension.ts` | `crypto`, `os` — replace with Web Crypto and `window.main` os-info helper. |
| `packages/insomnia-testing` carve-out | `generate/generate.ts`, `run/run.ts` counted by analyzer but never loaded by renderer. Add to allow-list. |

---

## Verification

- Per-PR: `npm run lint`, `npm run type-check`, `npm test`.
- After vault adapter lands: regression test encrypt/decrypt round-trip in a dev build; confirm no IPC calls to `vault.*` in DevTools.
- After env var second pass: confirm `window.env` is populated and `process.env` is inaccessible in a contextIsolation-enabled build.
- Before Phase 2 flag flip: full smoke run (`npm run test:smoke:dev`) covering plugin load, send-request, gRPC, OAuth, scripting, templating.
- After Phase 2 flag flip: in a dev build, confirm `typeof process === 'undefined'` in the renderer DevTools console; confirm hidden window retains full Node access.

## Exit criteria (Phase 2)

1. `contextIsolation: false` → `true` in `window-utils.ts` without renderer regressions.
2. All `window.env` reads in renderer code go through the contextBridge path; no renderer code touches `process.env` directly.
3. Vault crypto runs in the renderer via Web Crypto; IPC vault handlers removed from preload surface.
4. Security audit of the preload `contextBridge` surface complete (only necessary channels exposed).
5. Stretch: tighten `vite.config.ts` to fail (not baseline) on any new Node import in renderer code.
