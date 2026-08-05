# Security review — PR #10290 (H1, "route user-plugin request hooks through the sandbox (PR 10a) — sec request hooks review")

## Context

This PR (branch `review/pr10-hooks-security-fixes`) adds the templating-db protocol auth token
(F1), server-side `directory` resolution (F2'), and symmetric `stripDangerousKeysReviver` coverage
(F3) — closing the three findings recorded in
[H1-HOOK-CONTROL-BYPASS-REMEDIATION-PLAN.md](H1-HOOK-CONTROL-BYPASS-REMEDIATION-PLAN.md). This
review was scoped specifically to the authorization token added for `insomnia-templating-worker-
database://` IPC/protocol dispatch: (1) whether the token check itself can be circumvented, (2)
whether any existing caller doesn't correctly participate in it (breakage), and (3) if a gap is
found, why the branch's own dynamic tests didn't catch it.

Checked against the migration plan gist (fetched fresh this run): this PR is Phase 2, ticket H1,
depending on L1 (PR 9, landed) and preceding A1 (PR 11, actions-via-bridge — not yet landed). C1
(bridge capability gating), C2 (capability-aware context), and C3 (manifest schema/loader) — the
Phase 1 tickets that make `insomnia.permissions` a live enforcement boundary — are confirmed landed
in the current source (`host-bridge.ts`'s `BRIDGE_PATH_CAPABILITIES`/`filterByCapabilities`,
`in-sandbox-bootstrap.ts`'s per-capability context deletion, `common/plugins/permissions.ts`'s
`parsePluginPermissions`), per `SANDBOX-CAPABILITY-AUDIT-PLAN.md`'s own correction note.

## Verdict on the token mechanism itself

**No circumvention found.** `getOrCreateTemplatingDbAuthToken()`/`isValidTemplatingDbAuthToken()`
(`templating-worker-database-auth.ts`) is a per-process random 32-byte secret, compared with
`crypto.timingSafeEqual` after a length pre-check (standard, non-exploitable pattern — the length
pre-check can't be used to learn anything about the fixed-length real token). It is handed out only
over IPC channels that check `event.sender` against `getMainWindow()?.webContents` or
`getPluginWindow()?.webContents` (`ipc/templating-db-auth.ts`), mirroring the existing
`plugin-window.ts` sender-check pattern. The protocol scheme is registered app-wide-privileged
(`secure/standard/supportFetchAPI`, no `corsEnabled`) so it's reachable by any renderer/webview in
the session — but reachability without the token now yields 401 before any handler runs, closing
the original F1 gap. Every entry point that legitimately needs the token (main window, plugin
window, and the templating Web Worker, which cannot reach `window.main` itself) fetches or forwards
it before making any protocol call; ordering is safe because each fetch happens via a blocking
top-level `await` in that realm's entry module before other code in that realm runs.

Traced and ruled out: header-casing bypass (the Fetch `Headers` API is case-insensitive by spec),
a `resolveDbByKey` caller that skips the check (single choke point — `protocol.handle` registers
only this one function; grepped for all other `insomnia-templating-worker-database://` references,
found none outside this file and the trusted callers), a startup race where a legitimate call fires
before the token is set (fails closed — `fetchFromTemplateWorkerDatabase` omits the header entirely
if the token isn't set yet, which the server-side check rejects, rather than silently succeeding
unauthenticated), and the CLI/node-runtime path (`network-adapter.node.ts` calls
`runRequestHookInSandbox` as a direct function call, never through the protocol, so it has nothing
to authenticate and isn't affected by or a bypass of this control).

## Existing capabilities / callers: none found broken

Every caller of `fetchFromTemplateWorkerDatabase` was enumerated (`liquid-extension-worker.ts`,
`invoke-method.ts`, `plugins/index.ts`, `ui/templating/worker.ts`) and each runs in a JS realm that
now calls `setTemplatingDbAuthToken` before making a protocol call. The one pre-existing unit test
that called `resolveDbByKey` directly without a token (`templating-worker-database.test.ts`'s
`app.prompt` case) was already fixed in this branch (c28382d81). Re-ran the full local suite
(`templating/sandbox`, `plugin-window-ipc-authorization`, `templating-worker-database*`): 186/186
passing, no regressions.

## Finding 1 — Caller-supplied `permissions` bypasses the trusted registry, unlike `directory` (Low/Medium)

**Files:** `packages/insomnia/src/main/templating-worker-database.ts:738-763` (the
`plugin.discoverUserPluginExports` / `plugin.runUserRequestHook` entries in `pluginToMainAPI`).

**Verified:** yes — reproduced with a passing regression test (see below), not just read.

F2' fixed exactly one of the two trust-relevant fields these handlers take from the request body:
`directory` is now resolved server-side by `resolveTrustedPluginDirectory(name)` against the
registry (`getPlugins()`). `permissions` is not — it's still read straight off the body
(`body.permissions` / `body.plugin.permissions`) and passed to
`resolveTemplateTagModules`/`resolveTemplateTagCapabilities` unchanged. Since C1/C2/C3 are landed,
`insomnia.permissions` is a live enforcement boundary today (not the "already-planned, not yet a
real control" state the remediation plan's own scoping note assumed when it explicitly excluded the
"capability half" from F2's fix) — so this is the same class of bug F2' patched for `directory`,
just left half-done.

**Reproduced:** a plugin registered with `permissions: {}` (no capabilities, per `getPlugins()`,
the trusted registry) has a request hook that reports whether `context.network` was granted
(deleted from context unless the `network` capability is present — `in-sandbox-bootstrap.ts`'s
`__hasCap`). Calling `plugin.runUserRequestHook` over the (now correctly authenticated) protocol
with a forged `plugin.permissions.capabilities: ['network']` in the body causes the hook to observe
`context.network` as granted, contradicting the registry's own record for that plugin.

**Consequence:** any caller that can reach the protocol with a valid token (the trusted main/plugin
window realm itself, or, per the plan's own execution-surface table, a **user plugin's action** —
still un-sandboxed/full-Node until A1 lands) can force a *different*, already-installed plugin's
hook to run with elevated capabilities beyond what that plugin's own manifest declares — up to the
`TEMPLATE_TAG_PROFILE` ceiling (`network`/`storage`/`fs-read`/`app`, every registry module; `render`
capability set-relevant, `credentials` excluded). This is not a sandbox escape (the profile ceiling
still caps it, so it grants nothing a plugin couldn't already grant *itself* by declaring it), but
it is a real violation of manifest integrity/least-privilege for the *targeted* plugin, and — same
as F2' — the exact bug class this branch was in the middle of closing.

**Fix:** mirror F2' — in `resolveTrustedPluginDirectory` (or a sibling helper), also return the
resolved plugin's own `permissions` from the registry, and use that instead of trusting
`body.permissions`/`body.plugin.permissions` in both handlers.

**Test:**
`packages/insomnia/src/main/__tests__/templating-worker-database-protocol-authorization.test.ts`,
describe block `protocol-dispatch handlers trust caller-supplied 'permissions', not the registry
(residual gap from F2')` — two cases: a baseline call (no forged permissions) correctly gets no
`network` capability per the registry, and a forged-permissions call gets it anyway. Both pass
today (the second passing is the bug — it documents current, not desired, behavior; flipping the
handler to consult the registry should turn it into a real regression guard).

## Why the branch's own dynamic tests didn't catch this

The new `templating-worker-database-protocol-authorization.test.ts` iterates the live
`pluginToMainAPI` map for the *token* axis (every path/token combination) and has two focused
`directory`-forgery regression cases for F2' — but no equivalent case for the `permissions` field.
The H1 remediation plan's own scoping note is the direct cause: it explicitly filed
`body.plugin.permissions` as "the gist's already-planned manifest work — excluded," so nobody wrote
a permissions-forgery test alongside the directory one. That exclusion was accurate at the time the
*original* sandbox plan was written (capability grants were aspirational), but by the time this PR
landed, C1/C2/C3 had already shipped and made `permissions` a real, load-bearing control — the
scoping note wasn't updated to reflect that, and the test suite inherited the stale premise. This is
the same failure mode `SANDBOX-CAPABILITY-AUDIT-PLAN.md` already flagged once (a prior-art doc's
"deferred" framing going stale as later PRs landed) — recorded here as a second instance so a future
reviewer knows to double check plan-scoping notes for a PR against current `develop`, not just
against the plan doc's original framing.

## Excluded from this review

- **Plugin actions still executing un-sandboxed/full-Node for user plugins** — explicitly ticket A1
  (PR 11), not yet landed; the plan's own execution-surface table already tracks this as the
  mechanism by which Finding 1 above would be reached by genuinely untrusted code today. Not
  reported as a new gap of this PR.
- **`services.invoke` generic RPC gateway / cross-tenant DB access findings** — already recorded in
  `CROSS-TENANT-DB-ACCESS-FINDINGS.md`; unrelated to the auth-token mechanism this review targeted.
- **Bridge-dispatch prototype-object smell (`handlers[path]` against a plain object)** — already
  recorded as F3 in `M2-STDLIB-SECURITY-REVIEW.md`; `resolveDbByKey`'s own lookup already has the
  own-property guard this PR added (`Object.prototype.hasOwnProperty.call(withLowercasedKeys, ...)`
  at `templating-worker-database.ts:52`), so that specific instance is resolved, but the general
  finding in the other file stands as previously recorded, not re-reported here.

## Hypotheses chased down and ruled out

- Header-name casing used to smuggle a missing/forged token past the check — ruled out, Fetch
  `Headers` are case-insensitive.
- A second, unauthenticated call site to `resolveDbByKey`/the protocol scheme — ruled out by
  grep; `protocol.handle(templatingWorkerDatabaseInterface, resolveDbByKey)` is the only
  registration, and `fetchFromTemplateWorkerDatabase` is the only caller of the scheme in source.
  distinguish it from the two build artifacts `entry.main.min.js`/`entry.plugin-window.min.js`
  found by the same grep — pre-existing generated bundles, not source, and not part of this diff.
- Startup race where a real caller fires before `setTemplatingDbAuthToken` runs — ruled out; each
  entry module's fetch/forward is a blocking step before any other code in that realm runs, and a
  missing token fails closed (401) rather than silently succeeding.
- `getPluginWindow()`/`getMainWindow()` sender check racing against window (re)creation — ruled out
  by reading `createPluginWindow()`: `pluginWindow` is assigned synchronously before `loadFile`, so
  by the time the loaded page's JS runs and requests the token, the module-level reference already
  points at it.
- Plugin-related IPC channels registered outside `plugin-window.ts` that the static
  "no bare `ipcMain` call" guardrail (scoped to that one file) wouldn't catch — found two
  (`createPlugin`, `installPlugin` in `main/ipc/main.ts`) but they're pre-existing, unrelated to the
  `plugins.*`/hook-dispatch surface this PR's guardrail is about, and out of scope for this review.

## Verification

```
npm test -w packages/insomnia -- templating-worker-database-protocol-authorization
npm test -w packages/insomnia -- templating/sandbox plugin-window-ipc-authorization templating-worker-database
npx eslint packages/insomnia/src/main/__tests__/templating-worker-database-protocol-authorization.test.ts
npx tsc --noEmit
```

All green as of this review (186/186 tests across the touched suites; lint and typecheck clean).
