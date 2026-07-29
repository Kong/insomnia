# Plugin sandbox security findings tracker

Tracks every sandbox/plugin-security finding from the `sandbox-security-review` skill that is **not**
an instance of the bare-`_id`/ownership-lookup bug class — that class lives exclusively in
`CROSS-TENANT-DB-ACCESS-FINDINGS.md`. This doc covers everything else touched by the QuickJS/isolated-vm
migration: capability gating, permissions-trust resolution, the marshal/host-bridge boundary, hook/action
context construction, and dispatch-entry authorization. Two live sections: **Still unfixed** and
**Fixed**. Findings move from one to the other as patches land; they are never deleted (see the
skill's MD file lifecycle rules). A **Ruled out / non-issues** section preserves hypotheses that were
investigated and dismissed, so future reviews don't re-derive the same dead end.

This doc consolidates what were previously four separate per-PR reports
(`M2-STDLIB-SECURITY-REVIEW.md`, `H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md`,
`H1-RESPONSEHOOK-SETBODY-SECURITY-REVIEW.md`, `A1-PLUGIN-ACTIONS-SECURITY-REVIEW.md`) — going forward,
per the skill, no new per-PR doc is created; every review's findings land in this file or
`CROSS-TENANT-DB-ACCESS-FINDINGS.md`.

---

## Still unfixed

_None currently._

---

## Fixed

### `response.setBody`'s containment check had no symlink/realpath re-check (was Low, defense-in-depth)

**Files:** `packages/insomnia/src/main/templating-worker-database.ts` (`'response.setBody'` handler)
vs. the sibling `getPluginEntrySource`/`readPluginModuleMap` containment checks in the same file,
which explicitly re-verify via `fs.realpathSync` "since a symlinked entry can point outside base."

**Verified:** by reading, not reproduced pre-fix — no primitive in the current codebase let a caller
plant a symlink inside `responses/`, so this was not independently exploitable before the fix landed
either; fixed anyway as defense-in-depth, matching this file's own precedent (the bodyPath-ownership
path-normalization finding below was likewise fixed after being downgraded from reproducible).

Unlike its sibling containment checks in the same file, the `response.setBody` handler's
`path.resolve`/`path.relative` check did not re-verify via `fs.realpathSync` after resolution. If a
pre-existing symlinked directory inside `responses/` ever pointed outward (via a future bug, a manual
filesystem edit, or an OS-level TOCTOU), a write through it would follow the symlink and land outside
the directory the containment check is meant to enforce.

**Fix:** after the relative-path check, `response.setBody` now additionally verifies
`fs.realpathSync(path.dirname(target))` stays within `fs.realpathSync(responsesDir)` before writing —
mirroring `getPluginEntrySource`'s existing pattern, via the same `isContainedIn` helper
`readPluginModuleMap` already uses.

**Test:** `templating-worker-database-protocol-authorization.test.ts` — two new regression cases
(one via `plugin.runUserResponseHook`'s hook wrapper, one sent directly to `response.setBody`) that
create a symlinked subdirectory under `responses/` pointing at an external temp directory and confirm
the write is refused and the external file is never created.

### Caller-supplied `permissions` bypassed the trusted plugin registry (was Medium)

**Files:** `packages/insomnia/src/main/templating-worker-database.ts` (`resolveTrustedPlugin`, and its
call sites in `plugin.discoverUserPluginExports`, `plugin.runUserRequestHook`,
`plugin.runUserResponseHook`, `plugin.runUserAction`).

`directory` was resolved server-side from the trusted registry, but `permissions` was still read
straight off the request body and passed to `resolveTemplateTagModules`/`resolveTemplateTagCapabilities`
unchanged — letting a caller with a valid auth token force an already-installed plugin's hook/action to
run with capabilities beyond what its own manifest declared (capped at the profile ceiling, so not a
full sandbox escape, but a real manifest-integrity violation).

**Fix:** `resolveTrustedPlugin` now returns both `directory` **and** `permissions` from the registry
(`getPlugins()`), and every one of the four protocol-dispatch handlers uses `trusted.permissions`
instead of `body.plugin.permissions`/`body.permissions`. Verified present across all four handlers,
including the newest (`plugin.runUserAction`, added by A1) — the fix was carried forward correctly to
new call sites rather than needing to be reapplied.

**Test:** `templating-worker-database-protocol-authorization.test.ts` has explicit forged-permissions
regression cases for `plugin.discoverUserPluginExports` and `plugin.runUserRequestHook`. The fix is
verified present in source at all four call sites (see above), but `plugin.runUserResponseHook` and
`plugin.runUserAction` do not yet have their own forged-permissions regression case in this file —
coverage gap, not a source gap.

**Provenance, re-traced against source rather than assumed:**
- The fix landed as its own commit, `999af1675` ("fix(templating): resolve permissions from the
  trusted registry in hook/discovery dispatch"), on branch `review/pr10-hooks-security-fixes` — the
  branch this finding was originally caught and fixed on mid-review, one commit after the finding was
  first documented and regression-tested (`4296c76bc`).
- That branch was squash-merged into `develop` as commit `b4c36a39f` via **PR #10279**
  ("feat(templating): (H1) route user-plugin request hooks through the sandbox (PR 10a)", merged
  2026-07-23) — confirmed by diffing `b4c36a39f`'s copy of `templating-worker-database.ts` against
  `review/pr10-hooks-security-fixes`'s tip: byte-identical. `b4c36a39f` is in `origin/develop` and an
  ancestor of `sec/sandbox-cross-tenant-fixes`'s current tip.
- `plugin.runUserAction` (the fourth call site, added by A1) was never a window where this bug could
  have reappeared — it landed already using `resolveTrustedPlugin`'s registry-resolved `permissions`
  from its very first commit (`db2f159ae`/`0dc9b6caf`, "(A1) route user-plugin actions through the
  sandbox"), not as a later fix. Those A1 commits are local to `sec/sandbox-cross-tenant-fixes` only
  (not yet in `origin/develop`) — confirmed via `git merge-base --is-ancestor`.
- Re-verified directly against current source (not inferred from the above history): `git blame` on
  `templating-worker-database.ts`'s four handlers confirms all still call `resolveTrustedPlugin` and
  use `trusted.permissions`, and the token/sender-check mechanism this finding's PR also introduced
  (`getOrCreateTemplatingDbAuthToken`/`isValidTemplatingDbAuthToken` in
  `templating-worker-database-auth.ts`, the `event.sender` checks in `main/ipc/templating-db-auth.ts`,
  and the single `protocol.handle(templatingWorkerDatabaseInterface, resolveDbByKey)` registration in
  `main/api.protocol.ts`) is all still present and unchanged from what the original review verified.

### `assertResponseBodyPathOwnership`'s exact-string lookup could be bypassed by a path-normalization variant (was High in original write-up, corrected to non-reproducible-today, fixed anyway)

**Files:** `packages/insomnia/src/main/templating-worker-database.ts` (`assertResponseBodyPathOwnership`).

The ownership check looked up an existing owner via an exact-string NeDB match against the raw,
caller-supplied `bodyPath`, but the write itself targeted `path.resolve(bodyPath)`. Two different raw
strings (e.g. one with a `.`/`..` segment) can resolve to the same absolute file, so a caller
supplying a normalization-variant of a victim's real `bodyPath` could miss the ownership lookup
entirely (no existing owner found → check passes) while the write still landed on the victim's real
file.

**Reachability history:** originally written up assuming reachability once ticket A1 landed (routing
plugin actions through this bridge). Re-checked now that A1 (PR #10293) has actually landed:
`__invokeAction` builds context via `__buildContext` only and never calls `__buildResponseApi` — that
wiring exists only in `__invokeHook`, for response hooks. A plugin action has no `ctx.response` at all
and cannot reach `response.setBody` any more than a template tag can. A1 did not make this reachable;
the fix below closed it regardless, as defense-in-depth.

**Fix:** `assertResponseBodyPathOwnership` now resolves the caller-supplied `bodyPath` via
`path.resolve()` before querying for its owner, so the ownership check and the actual write agree on
which file they mean.

**Test:** `templating-worker-database-protocol-authorization.test.ts` (path-normalization-variant
regression cases) and `findHandlersThatBypassBodyPathOwnership` in `templating-worker-database-surface.ts`/`.test.ts`.

### `response.getBodyBuffer` had no ownership/containment check at all: arbitrary file read via any zero-permission template tag (was High, confirmed live with the sandbox toggle on)

**Files:**
- `packages/insomnia/src/main/templating-worker-database.ts` (`'response.getBodyBuffer'` handler)
- `packages/insomnia-data/node-src/services/helpers/response-operations.ts` (`getResponseBodyBuffer`)
- `packages/insomnia/src/templating/sandbox/host-bridge.ts` (`BRIDGE_PATH_CAPABILITIES['response.getBodyBuffer'] = 'models.read'`, part of `TEMPLATE_TAG_BASELINE_CAPABILITIES`)

`response.getBodyBuffer` forwarded `body.response` (a fully caller-supplied object) straight into
`getResponseBodyBuffer`, which did a raw `fs.promises.readFile(response.bodyPath)` with no reload-by-id,
no ownership check, and no containment check of any kind. Unlike `response.setBody` (host-pinned
`bodyPath`, no setter exposed to plugin script), `response.getBodyBuffer` takes `response` as an
ordinary function **parameter** reachable from any plugin's own `run()`/hook/action code — and
`models.read` (which gates this path) is baseline, granted to every template tag with **zero**
manifest declaration. Confirmed reproduced three ways: directly against the handler, through the real
QuickJS sandbox with only baseline capabilities granted, and end-to-end through the real running app
via a Playwright smoke test with "Run template tags in sandbox" enabled.

**Consequence:** an installed plugin with a template tag declaring zero permissions could read the
contents of any file on disk the Electron main process can read (SSH keys, `.netrc`, cloud credential
files, etc.), as long as the sandbox toggle was on — worse than the toggle being off, since the
toggle's entire purpose is to make untrusted plugins safer to run.

**Fix:** `assertResponseBodyPathReadOwnership` (mirroring the write-side `assertResponseBodyPathOwnership`'s
naming) now rejects any `bodyPath` that doesn't belong to an already-persisted response, before
`response.getBodyBuffer` reads it. This closes the arbitrary-file-read primitive; it does **not**
fully close cross-response reads within the same local install (the caller can still read *some other*
real response's body if it can guess/enumerate that response's `bodyPath`) — that residual gap is the
same root cause `CROSS-TENANT-DB-ACCESS-FINDINGS.md` tracks, not duplicated here.

**Test:** `packages/insomnia/src/main/__tests__/templating-worker-database-bodypath-read.test.ts`
(drives the real handler directly, and end-to-end through the real QuickJS engine with only baseline
capabilities) and `findHandlersThatLeakArbitraryBodyPathReads` in
`templating-worker-database-surface.ts`/`.test.ts`.

**Smoke test:** `packages/insomnia-smoke-test/tests/smoke/response-bodypath-read-scope.test.ts` —
installs a zero-permission plugin, enables the sandbox via the real Preferences UI, asserts the tag's
Live Preview discloses a secret file's contents. Passed against unpatched source (demonstrating the
bug), then reran clean against the fix.

**Independent verification:** CONFIRMED — reproduced in two separate from-scratch runs against
unpatched source (one direct, one by an independently-dispatched adversarial-verification agent), plus
a manual `PWDEBUG=1` Playwright Inspector run the operator watched directly. Re-ran clean after the fix
landed.

---

## Ruled out / non-issues

Preserved so future reviews don't re-investigate the same dead ends.

**From the M2 stdlib review (PR #10220, "does anything passed into the sandbox grant host global
namespace access?"):**
- No reference-based escape to the host global namespace exists. All data crosses the boundary as
  JSON strings/primitives (`marshal.ts`'s `encodeBridgeSuccess/Failure`); all host functions return
  only a VM string/promise, never a host object reference.
- Shim sources (`SANDBOX_GLOBALS_SOURCE`, `*_FACTORY` strings) are static in-repo literals with no
  runtime interpolation; `MODULE_REGISTRY_SOURCE` guards its one interpolation point with a `/^function\b/`
  tripwire.
- No in-VM prototype pollution: `for..in` is `hasOwnProperty`-guarded, `EventEmitter` uses
  `Object.create(null)`, `process` and sub-objects are frozen.
- DoS is bounded: 10s interrupt deadline, 32MB WASM heap cap, `randomBytes` clamped to 65536, WebCrypto
  quota guard.
- The bridge dispatch's `handlers[path]` lookup, and `resolveDbByKey`'s equivalent, are both guarded
  with `Object.prototype.hasOwnProperty.call(...)` — a path like `"constructor"`/`"__proto__"` can't
  resolve to an inherited member.
- `__hostBridge` is captured into a closure and `delete`d from `globalThis` before plugin code runs —
  not reachable as a plain global.

**From the H1 request-hook auth-token review (PR #10290):** the per-process, timing-safe-compared
templating-DB auth token mechanism has no circumvention: no header-casing bypass (Fetch `Headers` are
case-insensitive), no second unauthenticated dispatch path (`resolveDbByKey` is the sole registration),
no startup race (missing token fails closed), no sender-check race in plugin-window creation. Every
caller of `fetchFromTemplateWorkerDatabase` correctly sets the token before its first protocol call.

**From the A1 plugin-actions review (PR #10293), five-lens sweep:**
- **Unchecked dispatch entry:** `plugin.runUserAction` has no manifest-level allowlist of its own, but
  `__invokeAction` only ever searches the *already-identified* plugin's own action list by label, so no
  path lets one plugin's action fire under a different plugin's identity or capability grant. Also
  unreachable from inside a running sandbox: it has no entry in `BRIDGE_PATH_CAPABILITIES`, so
  `filterByCapabilities` fails closed on it, and the raw `__bridge` function is a private closure never
  exposed on `globalThis`.
- **Unsanitized boundary merge:** the VM-side envelope parse (`JSON.parse(globalThis.__envelopeJSON)`,
  `in-sandbox-bootstrap.ts`) has no `stripDangerousKeysReviver`, unlike host-side parses of sandbox
  output — but this is not exploitable: `JSON.parse` without a reviver can't itself repoint a
  prototype, and the only code positioned to turn a `__proto__` key into real `[[Set]]`-based pollution
  is the plugin's own action function, which already has unrestricted access to that same disposable,
  per-call QuickJS realm. Worth a one-line consistency fix, not a security finding. Separately, the
  action's fire-and-effect design was traced end-to-end (`__invokeAction` → `runActionInSandbox` →
  `plugin.runUserAction` → `invoke-method.ts`) and confirmed: no value derived from action execution is
  ever merged onto a live host object.
- **Bare-id/ownership lookups:** see `CROSS-TENANT-DB-ACCESS-FINDINGS.md` Finding 5 — the one
  substantive candidate this lens produced was folded there, not reported here, after adversarial
  verification showed it predates A1.
- **Raw host natives:** `__invokeAction` writes no new global; VM setup (bridge/crypto capture-then-delete)
  runs unconditionally before runner selection, so the action path gets identical lockdown to
  tags/hooks; the new `__invokeAction` global is correctly covered by the existing `sandbox-surface.ts`
  detectors.
- **Reference-identity leaks:** reusing the template-tag capability/module profile ceiling for actions
  matches the plan's actual design (no separate action profile is defined anywhere in the plan; hooks
  already set this precedent). `__buildContext`'s shared branches behave identically regardless of
  which runner (`__invoke`/`__invokeHook`/`__invokeAction`) calls it. The envelope never carries the raw
  `plugin.permissions` object or `directory` string, only the two derived grant arrays.
- Minor parity gap noted, not a security issue: `invoke-method.ts` never forwards a `renderContext` for
  actions (unlike hooks), so `ctx.context` is always `{}` for actions today.

---

## Verification

```bash
cd packages/insomnia
npx eslint src/templating/sandbox/*.ts src/main/templating-worker-database.ts src/plugins/invoke-method.ts
npx tsc --noEmit
npm test -- templating/sandbox
npm test -- main/__tests__/templating-worker-database
```
