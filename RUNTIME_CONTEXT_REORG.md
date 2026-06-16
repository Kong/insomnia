# Runtime-Context Folder Reorganization (usage-driven)

> Single source of truth for dissolving the ambiguous top-level feature folders
> under `packages/insomnia/src` (`account/`, `templating/`, `plugins/`, `utils/`,
> `scripting/`) into the runtime-context folders the ESLint config already
> enforces. Placement is decided by **who actually imports each file**, not by
> what the file is named or "feels" like.

## Placement rule

For each file, look at the execution context of its importers (transitively, via
the build entry points: `entry.main` = main; `entry.client`/`root`/`*.worker`/
`entry.hidden-window`/`entry.preload`/`entry.plugin-window` = renderer):

1. **Uses `getRuntime()`** → placed by the same usage rule as everything else.
   getRuntime is isomorphic (no Node built-in, no DOM global), so such files are
   eligible for `common/` when used by both sides, `ui/`/`main/` when used by
   one. *(They are never forced to stay put; the earlier "leave in place" idea is
   superseded — placing by usage leaves no residual feature folders.)*
2. **Imported only by renderer-side code → `ui/`.**
3. **Imported only by main-side code → `main/`.**
4. **Imported by both → `common/`.** `common/` is the existing isomorphic
   bucket — the ESLint config already forbids DOM globals *and* Node built-ins
   there, so only genuinely shared, platform-neutral code qualifies.
5. **Imported only within its own dissolving folder / via a barrel → follows its
   consumer.** Resolve once the consumer's destination is fixed.

`common/` must therefore stay small: it is *only* for code proven to be imported
from both sides. A file used by just one side never goes to `common/`, even if
it looks isomorphic.

Why this works with zero new ESLint config: the flat config in
`eslint.config.mjs` already pins context by folder —
`ui/`,`routes/`,`basic-components/` and `*.renderer.*` forbid Node built-ins;
`common/` forbids Node built-ins **and** `window`/`document`; `main/` and
`*.node.ts` forbid DOM globals; `*.worker.ts` forbids both. The top-level feature
folders are simply *uncovered* today. Moving each file into the right folder is
what makes the existing rules apply — lint becomes the correctness oracle.

## Evidence

Importer contexts were collected with a folder-qualified token search
(`<folder>/<name>` matches every alias and relative import form, avoiding
basename collisions). Buckets: RNDR (renderer), MAIN, NET (`network/`),
RT (`runtimes/`), COMMON, SYNC, SELF (same dissolving folder).
`getRuntime` files are marked ☆ and stay put.

## Placement by folder

### `account/`  → dissolves entirely (session split by import group)

`session.ts` is split by its three distinct import signatures, so each output
file has exactly one runtime context:

| Import group | Functions | → File | Context |
|--------------|-----------|--------|---------|
| `insomnia-data` only | `SessionData`, `getUserSession`, `getCurrentSessionId`, `getAccountId`, `isLoggedIn`, `setSessionData`, `setVaultSessionData`, `unsetSessionData` | `common/account/session.ts` | isomorphic (used by both: sentry/vcs main + routes/ui) |
| `insomnia-data` + `~/runtimes` | `getPrivateKey` | `common/account/session.ts` (same file — `getRuntime` is isomorphic) | isomorphic (vcs main + invite-modal renderer) |
| `insomnia-api` + `window` + `~/common/{constants,database}` | `absorbKey`, `logout`, `_removeAllCredentials`, `_removeGitRepository`, `migrateFromLocalStorage` | `ui/account/session.ts` (re-exports the common core) | renderer-only by usage |

> Groups 1 and 2 share a file because `~/runtimes` is isomorphic and `common/`
> permits it; if you'd rather isolate the `getRuntime` call, peel `getPrivateKey`
> into `common/account/keys.ts`. Group 3's functions all touch `window`/
> `window.main` (or are private helpers only those touch), and every caller is
> renderer-side, so no IPC plumbing is needed.

| File | Importers (evidence) | Destination | Confidence |
|------|----------------------|-------------|------------|
| `crypt.ts` | MAIN (ipc) + RT (node & renderer crypto adapters) | **`common/account/`** | high — used by both; `window.crypto`→`globalThis.crypto` to satisfy common/ |

Main callers (`sentry` → `isLoggedIn`; `cloud-sync/vcs` → `getUserSession`,
`getPrivateKey`) import the common file; renderer callers import the ui file
(which re-exports the common core, so they keep one import surface).

### `utils/`  → residual keeps `vault.ts`
| File | Importers | Destination | Confidence |
|------|-----------|-------------|------------|
| ☆ `vault.ts` | RNDR (ui, routes) + MAIN-side (`runtimes/crypto/crypto-adapter.node`) + mask-or-decrypt | **`common/utils/`** | high — used by both; getRuntime ok in common |
| `router.ts` | RNDR ×148 | `ui/utils/` | high |
| `try-interpolate.ts` | RNDR ×6 (imports `ui/components/modals`) | `ui/utils/` | high |
| `index.ts` (barrel) | `~/utils` (DOM: HTMLElement, react-stately) | `ui/utils/` | high |
| `grpc.ts` | RNDR | `ui/utils/` | high |
| `string-check.ts` | RNDR | `ui/utils/` | med (1 importer) |
| `sealedbox.ts` | MAIN | `main/utils/` | high |
| `environment-utils.ts` | RNDR + NET + COMMON + KON | `common/utils/` | high |
| `graph-ql.ts` | RNDR + MAIN + NET | `common/utils/` | high |
| `plugin-name.ts` | RNDR + MAIN | `common/utils/` | high |
| `invariant.ts` | RNDR + MAIN + COMMON + SYNC + SCRIPT (re-export of `insomnia-data/common`) | `common/utils/` | high |
| `utf8-bytes.ts` | RNDR + NET | `common/utils/` | high |

### `plugins/`  (no getRuntime files)
| File | Importers | Destination | Confidence |
|------|-----------|-------------|------------|
| `index.ts` (node: fs, path, require) | MAIN (barrel) | `main/plugins/` | high |
| `invoke-method.ts` | RNDR (plugin-window, preload); pulls `context/*` | `main/plugins/` | **verify** — runs in the node-enabled plugin host; confirm vs ui |
| `context/` (node:stream, fs) | index, invoke-method | `main/plugins/` | high |
| `renderer-bridge.ts` | RNDR ×16 | `ui/plugins/` | high |
| `create.ts` | RNDR (`window.main`) | `ui/plugins/` | high |
| `misc.ts` | RNDR (DOM `<style>`) | `ui/plugins/` | high |
| `types.ts` | RNDR + MAIN | `common/plugins/` | high |
| `bridge-types.ts` | RNDR + MAIN | `common/plugins/` | high |
| `themes.ts` | index (main) + theme hooks (renderer) | `common/plugins/` | **verify** consumer split |

### `templating/`  → residual keeps `mask-or-decrypt-vault-data.ts`
| File | Importers | Destination | Confidence |
|------|-----------|-------------|------------|
| ☆ `mask-or-decrypt-vault-data.ts` | COMMON (render) + NET (network) | **`common/templating/`** | high — used by both; getRuntime ok in common |
| `liquid-extension.ts` (node:crypto, node:os) | internal (engine) | `main/templating/` | high (node) |
| `worker.ts` | RNDR | `ui/templating/` | high |
| `renderer-safe.ts` | RNDR ×7 | `ui/templating/` | high |
| `constants.ts` | RNDR + COMMON | `common/templating/` | high |
| `types.ts` | RNDR + MAIN + NET + RT | `common/templating/` | high |
| `render-error.ts` | RNDR + MAIN + NET + COMMON | `common/templating/` | high |
| `render-context-serialization.ts` | RNDR + RT | `common/templating/` | high |
| `utils.ts` | RNDR + MAIN + COMMON (CodeMirror **type** imports only) | `common/templating/` | **verify** no DOM globals |
| `liquid-engine.ts` | worker (ui) + liquid-extension (main) | `common/templating/` | **verify** transitive |
| `liquid-extension-worker.ts` | worker (ui) + plugin host (main) | `common/templating/` | **verify** transitive |
| `tokenize-args.ts` | liquid-extension (main) + utils + worker | `common/templating/` | **verify** transitive |
| `faker-functions.ts` | postman importer (main) + local-template-tags | `common/templating/` | **verify** transitive |
| `local-template-tags.ts` | worker (ui) + main | `common/templating/` | **verify** transitive |
| `index.ts` (barrel) | RNDR + MAIN + RT | `common/templating/` or `ui/` | **verify** what it re-exports |

### `scripting/`  (no getRuntime files)
Reached from `entry.hidden-window(-preload)`, `script-executor.ts`, and
`ui/components/settings/scripting-settings.tsx` — i.e. the hidden-window
(renderer) script-execution path, **not** `main/` directly.
| File | Importers | Destination | Confidence |
|------|-----------|-------------|------------|
| `run-script.ts` | RNDR (hidden-window) | `ui/scripting/` | **verify** — confirm hidden-window is renderer-context |
| `sandbox.ts` | hidden-window | `ui/scripting/` | **verify** |
| `require-interceptor.ts` | sandbox + script-executor | `ui/scripting/` | **verify** |
| `script-security-rules.ts` | RNDR | `ui/scripting/` | **verify** |
| `script-security-policy.ts` | sandbox (SELF) | follows sandbox | **verify** |

> `scripting/` is the least certain: it's all renderer-side by current usage, but
> "sandbox/require-interceptor" read as node concepts. Confirm the hidden-window
> execution context before committing — it may warrant `ui/` or its own
> context, not `main/`.

## Outcome (as executed)

`account/` and `utils/` dissolve entirely. `plugins/` and `templating/` are
mostly emptied but keep a small **dual-context host residual**, and `scripting/`
stays whole — see below. Every getRuntime file was placed by usage:
`getPrivateKey`, `vault.ts`, and `mask-or-decrypt-vault-data.ts` are each used by
both sides, so all three landed in `common/`.

### The fourth context: node-enabled sandbox/host windows

Three areas turned out to be genuinely **dual-context** — they use Node builtins
*and* `window`/`window.main` in the same module because they execute in a
node-enabled BrowserWindow (the plugin window / hidden script-sandbox window),
not the plain renderer or main process. They fit none of `ui/`/`main/`/`common/`
and the existing ESLint config leaves them uncovered, so they remain as
purpose-named residual folders:

- `plugins/` — `index.ts` (forks on `__IS_RENDERER__` between `window.main` and
  `electron.shell`), `invoke-method.ts`, `context/`, `themes`. The plugin host.
- `templating/` — `index.ts` + `liquid-extension.ts` (`node:crypto`/`node:os`
  **and** `window.main.secureReadFile`). The non-worker template renderer.
- `scripting/` — `sandbox.ts`, `require-interceptor.ts`,
  `script-security-{policy,rules}.ts`, `run-script.ts`. The script sandbox.
  (Left whole; it was not in the original split request.)

These residuals are the honest representation of a real execution context, not
leftovers. A future pass could split each into a renderer client + a node host
across an IPC boundary, but that is a larger change than a folder move.

### Validation

`npm run type-check` (all workspaces) = 0 errors, `npm run lint` = clean,
`vitest run` (insomnia) = 1768 passed. Committed per folder.

## Execution

Per folder, in order `account → utils → plugins → templating → scripting`,
committing after each so the PR has reviewable history:

1. **Move** with `git mv` (history follows the file).
2. **Rewrite imports** to the `~/` alias for the new path. Use folder-qualified
   search/replace (`account/crypt` → `common/account/crypt`) so sibling files
   with the same basename are untouched. Drive correctness with
   `npx tsc --noEmit -p packages/insomnia/tsconfig.json` (it names every stale
   specifier).
3. **Resolve the `verify` rows** by checking the file's real consumers/imports
   before fixing its folder; let lint confirm context (`npx eslint <paths>` —
   a Node import in `ui/`/`common/`, or `window` in `common/`/`main/`, fails).
4. **Validate**: `npm run type-check`, `npm run lint`, then
   `npm test -w packages/insomnia` (run vitest from inside `packages/insomnia`
   so its `~` alias config applies). Rollback is `git reset --hard`.

No new ESLint config is required — moving files into `ui/`/`main/`/`common/`
makes the existing context rules apply. The pre-push hook blocks on type errors
and context violations, so green type-check + lint is the bar.
