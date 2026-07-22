# Security review — PR #10279 (H1, "route user-plugin request hooks through the sandbox")

## Status: both findings remediated

- **Finding 1 (IPC dispatch accepts any sender): FIXED.** `plugin-window.ts` now routes every
  `ipcMain.handle`/`ipcMain.on` registration through one of three sender-checked wrapper
  functions (`handleFromMainWindow`, `onFromPluginWindow`, `handleFromPluginWindow`).
  `plugins.applyRequestHooks` and its dispatch siblings now reject any caller that isn't the
  real main app window. A **static** guardrail test asserts no bare `ipcMain.handle`/`.on` call
  exists in the file outside those three wrapper bodies, so a future channel added any other
  way fails the build automatically; a **dynamic** test iterates every channel actually
  registered at runtime (not a hardcoded name list) and proves each one rejects a forged
  sender and accepts the real main window. See "Remediation" below.
- **Finding 2 (unsanitized JSON marshal): FIXED (defense-in-depth).** The hook-mutation parse
  now uses a `JSON.parse` reviver that strips `__proto__`/`constructor`/`prototype` own-keys at
  any depth, and the merge onto the live request object now copies only the
  `HOOK_REQUEST_FIELDS` allowlist field-by-field instead of a blanket `Object.assign`. A
  dynamic/parameterized test (`marshal.test.ts`) drives the real sandbox with several
  differently-shaped attack payloads and asserts no dangerous key survives anywhere in the
  final merged object.

## Context

PR #10279 (`claude/sandbox-pr10-hooks`, stacked on the merged L1 discovery/rejecting-bridge
work) routes a **user** plugin's `requestHooks` through the QuickJS sandbox instead of
running them in-process, so a hook can still rewrite headers/URL/body/params/auth but is
claimed to "no longer reach the host beyond its declared capabilities" (PR description).
This review source-audited that claim, plus the surrounding architecture it leans on
(`__buildRequestApi`, capability resolution, plugin loading). Findings below are verified
against the current source (read directly) unless noted; several plausible hypotheses were
also chased down and ruled out — recorded for completeness so a future reviewer doesn't
re-walk the same dead ends.

## Finding 1 — `plugins.applyRequestHooks` (and siblings) accept a request from any sender

**Files:**
- `packages/insomnia/src/main/plugin-window.ts:291-292` (the dispatch handlers)
- `packages/insomnia/src/main/plugin-window.ts:82-133` (the sibling handlers that *do* check)
- `packages/insomnia/src/entry.preload.ts:449-450` (renderer exposure)
- `packages/insomnia/src/plugins/invoke-method.ts:190-214` (`applyRequestHooks` case)

**Verified:** yes, read directly, and demonstrated with an executable test (see below).

`main/plugin-window.ts` registers two different kinds of IPC listener. The first group
(lines 82-133: `plugins.uiAlert`, `plugins.uiDialog`, `plugins.uiPrompt`,
`plugins.invokeResult`) explicitly checks the caller:

```ts
ipcMain.on('plugins.uiAlert', (event, options) => {
  if (event.sender !== pluginWindow?.webContents) {
    return;
  }
  getMainWindow()?.webContents.send('plugins.uiAlert', options);
});
```

The second group (lines 260-293), registered by `registerPluginIpcHandlers()`, does not:

```ts
ipcMain.handle('plugins.applyRequestHooks', (_event, args) => invokeInPluginWindow('applyRequestHooks', args));
ipcMain.handle('plugins.applyResponseHooks', (_event, args) => invokeInPluginWindow('applyResponseHooks', args));
```

`_event` is deliberately unused — there is no check that the caller is the main app window,
no check that it's *any* particular window, nothing. This handler is exposed directly to the
main renderer as `window.main.plugins.applyRequestHooks(args)`
(`entry.preload.ts:449`, `invokePluginBridgeMethod('applyRequestHooks', args)`), which
forwards straight into `invokePluginMethod('applyRequestHooks', {renderedRequest, projectId,
environment})` (`plugins/invoke-method.ts:192`) — **all three fields fully caller-supplied**,
with no check that they describe a request that is actually being sent, or that the caller
is entitled to trigger hook execution for that `projectId`/`environment` at all.

**Consequence:** whatever capability gating H1 enforces *once a hook is running inside the
sandbox* is beside the point if the dispatch that reaches it never checks who's asking, with
what data. Any code able to reach `window.main.plugins.applyRequestHooks(...)` (or the
underlying `ipcMain.handle('plugins.applyRequestHooks', ...)` channel directly, e.g. from a
plugin's own code running unsandboxed today — plugin *actions* are still in-process pending
the later "A1" phase) can:
- Trigger **every installed plugin's** request hooks (not just its own) against a fully
  forged `renderedRequest`/`environment`, and read back the merged/mutated result directly
  over the IPC response.
- Use this as a confused-deputy exfiltration primitive: if any installed plugin's hook
  conditionally attaches a secret/header based on URL or environment-variable matching (a
  completely ordinary thing for an auth-helper plugin to do), craft a forged request that
  satisfies the condition, invoke the handler directly, and read the injected secret back out
  — without ever sending a real network request.

**This gap predates PR #10279** — the PR's diff never touches `plugin-window.ts` or
`entry.preload.ts`, and the asymmetry (checked vs. unchecked handler groups) already existed
before this PR. It is recorded here, not as a regression introduced by #10279, but because it
directly undermines the security property #10279 states it delivers: no amount of in-sandbox
capability gating matters if the dispatch entry point in front of it has no notion of "who is
allowed to ask for this, with what data." Recommend adding a sender check (mirroring the
first handler group) to `plugins.applyRequestHooks`, `plugins.applyResponseHooks`,
`plugins.executeAction`, `plugins.executePluginMainAction`, and `plugins.runTemplateTagAction`
— restricting them to the legitimate first-party caller (the main app window), the same way
the reverse-direction handlers already restrict themselves to the legitimate plugin window.

**Remediation:** `plugin-window.ts` now defines three wrappers — `handleFromMainWindow`
(restricts a channel to the real main app window; used by every channel
`registerPluginIpcHandlers()` registers, including `applyRequestHooks`/`applyResponseHooks`),
`onFromPluginWindow`, and `handleFromPluginWindow` (both restrict a channel to the real plugin
window, matching the pre-existing checked group) — and every `ipcMain.handle`/`ipcMain.on`
call in the file goes through one of them. A forged sender now gets a rejected promise
(`handleFromMainWindow`) or is silently ignored (`onFromPluginWindow`/`handleFromPluginWindow`,
matching prior behavior for that direction), never a result built from its data.

**Test:** `packages/insomnia/src/main/__tests__/plugin-window-ipc-authorization.test.ts` —
drives the real `plugin-window.ts` module (not a reimplementation). Two kinds of guardrail,
per the "dynamic catching" goal (not one hardcoded per-channel test):

- **Static**: reads the file's source and asserts no bare `ipcMain.handle(`/`ipcMain.on(` call
  exists outside the three wrapper bodies — a future channel registered any other way fails
  the build regardless of its name.
- **Dynamic**: after calling `registerPluginIpcHandlers()`, iterates every channel *actually
  registered* at runtime (reading the live registration map, not a hardcoded list of channel
  names) and asserts each one rejects a forged sender and accepts the real main window — so a
  newly added `plugins.*` channel is exercised automatically the next time the suite runs.
- Plus two representative end-to-end/contrast checks: `plugins.applyRequestHooks` explicitly
  with the original forged-payload scenario, and `plugins.uiAlert` to show the
  plugin-window-direction check still works.

## Finding 2 (minor, defense-in-depth only — not a regression) — unsanitized JSON marshal on the hook-mutation merge

**Files (as originally found):**
- `packages/insomnia/src/runtimes/network/network-adapter.node.ts` (`Object.assign(newRenderedRequest, mutated)`)
- `packages/insomnia/src/plugins/invoke-method.ts` (same pattern)
- `packages/insomnia/src/templating/sandbox/in-sandbox-bootstrap.ts` (`__buildRequestApi`)

The host merged a hook's mutated request back with `Object.assign(newRenderedRequest,
mutated)`, where `mutated = JSON.parse(json)` and `json` is whatever the sandbox returned. No
key-name sanitization or type/shape validation happened at this boundary. A hook could plant
an own `"__proto__"` property inside nested `body`/`authentication` objects (e.g.
`context.request.setBody(JSON.parse('{"__proto__":{"x":1},"text":"hi"}'))`, using
computed-key construction so the property is a real own key rather than triggering the
prototype setter), and it survived the sandbox→host JSON round-trip intact.

I traced every downstream consumer of `RenderedRequest.body`/`.authentication`/`.headers`
(`network/network.ts` → `main/network/libcurl-promise.ts`/`curl.ts`, HAR export in
`main/har.ts`, `network/apply-default-headers.ts`, `network/parse-header-strings.ts`) and
found only safe copy patterns (`clone()`, object spread, direct property reads) — **no
`Object.assign`/`for...in`-assignment/lodash-merge sink currently exists** that would turn
this into live `Object.prototype` pollution. I also confirmed the identical risk already
exists in the pre-existing **legacy in-process** hook path
(`plugins/context/request.ts`'s `setBody`/`setAuthenticationParameter` accept the same
unsanitized values by direct reference — no serialization needed to reach the same state) —
so sandboxing neither introduced nor worsened this; it's an existing characteristic of the
plugin-hook trust model, not a vulnerability attributable to this PR. Fixed anyway as cheap
defense-in-depth, since a future unrelated change (a deep-merge/deep-clone added elsewhere)
could turn this latent primitive into real pollution with no warning.

**Remediation:** both moved to shared, boundary-neutral code in
`packages/insomnia/src/templating/sandbox/marshal.ts` (importable from both the main-process
call site in `network-adapter.node.ts` and the renderer/plugin-window call site in
`invoke-method.ts`, avoiding a `main/`-into-`renderer` import):

- `stripDangerousKeysReviver` — a `JSON.parse` reviver dropping `__proto__`/`constructor`/
  `prototype` own-keys at any depth (returning `undefined` from a reviver deletes the key, per
  spec). Used in `runRequestHookInSandbox`'s `JSON.parse(json, stripDangerousKeysReviver)`.
- `mergeHookRequestMutation(target, mutated)` — replaces the blanket `Object.assign` with a
  loop over the fixed `HOOK_REQUEST_FIELDS` allowlist, copying a field only if `mutated` has it
  as an own property. Used at both call sites instead of `Object.assign(newRenderedRequest,
  mutated)`.

**Test:** `packages/insomnia/src/templating/sandbox/marshal.test.ts` — dynamic/parameterized
rather than one hardcoded case: `DANGEROUS_KEY_SCENARIOS` describes several different places a
hook can plant `__proto__`/`constructor`/`prototype` (inside a hook-supplied body, inside an
authentication value, nested two levels deep), and a recursive `findDangerousOwnKeyPaths`
walker searches the *entire* result structure for survivors rather than checking one specific
path. Each scenario runs the real `runTagInSandbox` end-to-end, confirms the attack actually
plants the key against a naive `JSON.parse` (so the test fails for the right reason if the
attack stops working), then asserts the fixed parse and the fixed merge both come out clean. A
separate test confirms `mergeHookRequestMutation` never copies a field outside
`HOOK_REQUEST_FIELDS`, regardless of what the parsed object contains.

## Hypotheses chased down and ruled out (recorded so a future pass doesn't repeat this work)

- **Capability defaults for undeclared-permission plugins**: `resolveTemplateTagModules`/
  `resolveTemplateTagCapabilities` (`templating/sandbox/surface-profiles.ts`) default missing
  `modules`/`capabilities` to `[]` at every layer (parsing in `common/plugins/permissions.ts`,
  the resolve functions, `host-bridge.ts`'s `filterByCapabilities`, and
  `in-sandbox-bootstrap.ts`'s `__grantedCaps = (__env && __env.grantedCapabilities) || []`).
  Fail-closed everywhere; a plugin never gets `network`/other elevated capabilities just by
  omitting a manifest.
- **`plugin.directory === ''` sandbox-bypass**: only bundle plugins (`plugins/index.ts:268`,
  `main/templating-worker-database.ts:595,630`) and the themes loader ever get
  `directory: ''`; disk-loaded plugins always get a real `path.resolve`d directory
  (`plugins/index.ts:124,192`). The new `if (sandboxEnabled && plugin.directory !== '')` gate
  can't be tricked into treating an untrusted disk plugin as a trusted bundle plugin.
- **Plugin-name collision desyncing `hookIndexByPlugin`**: `pluginMap` in `plugins/index.ts`
  is keyed by `pluginJson.name` and last-writer-wins, so `getPlugins()`/`getRequestHooks()`
  can never yield two distinct `Plugin` objects with the same `name` simultaneously — the
  index-recovery-by-name counter in the new hook-dispatch code can't desync this way (a name
  collision causes silent plugin shadowing instead, a pre-existing, separate issue, not
  explored further here).
- **`__buildRequestApi` parity vs. real `plugins/context/request.ts`**: line-by-line
  comparison confirms the ES5 rebuild in `in-sandbox-bootstrap.ts` matches getters/mutators,
  case-insensitive header vs. case-sensitive parameter matching, and the exact `readOnly`
  deletion list. No extra capability leaks through this rebuild.
- **Shared `__buildContext` gating**: hooks and tags both go through the same
  `__buildContext(env)`, so C1/C2 capability gating (`context.network` presence/absence)
  applies identically; nothing hook-specific weakens it.

## Verification

- `plugin-window-ipc-authorization.test.ts` (6 tests) — static guardrail + dynamic per-channel
  sender checks + the original forged-payload/contrast/end-to-end scenarios, all passing.
- `marshal.test.ts` (10 tests) — parameterized dangerous-key scenarios + allowlist-merge test,
  all passing.
- Full package suite (`npx vitest run`): 132 test files, 2107 tests passed, 14 skipped, 0
  failures — no regressions from either fix.
- `npm run lint -w packages/insomnia`: 0 errors (2 pre-existing warnings in unrelated vendored
  generated files).
- `tsc --noEmit -p packages/insomnia`: 0 errors.
