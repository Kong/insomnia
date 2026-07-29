# Cross-project / cross-org local DB access — findings tracker

Tracks every reachable instance of one bug class across the plugin/template sandbox and adjacent
RPC surfaces: a bare `_id`/`parentId` lookup (or write) against the local NeDB with no
ownership/ancestor-chain check, letting template/plugin/renderer-supplied values reach data outside
the caller's own workspace/project/org. Per the `sandbox-security-review` skill, **every** finding of
this specific class — regardless of which PR's review discovers it — is recorded here, not in a
per-PR report. This doc has two live sections: **Still unfixed** and **Fixed**. Findings move from
one to the other as patches land; they are never deleted (see the skill's MD file lifecycle rules).

## Root cause (applies to every finding below)

Every `insomnia-data` service (`packages/insomnia-data/node-src/services/*.ts`) does a bare
`_id`/`parentId` lookup against the whole local NeDB with **no ownership/scope check** — nothing
verifies a matched record's ancestor chain (workspace → project → org) matches the caller's current
context. There is also no `organizationId` concept anywhere in the local render/script pipeline to
check against even if a fix wanted to.

A trustworthy anchor *does* exist and is currently unused for authorization: `getRenderContext`
(`packages/insomnia/src/common/render.ts:355-397`) derives `workspace`/`project` by walking
`db.withAncestors(request)` from the real `Request` document being rendered — computed before any
template/plugin code runs, so it can't be forged by template content. It's exposed to running
templates only as inert metadata via `getMeta()` → `{ requestId, workspaceId }` (`render.ts:468-471`)
and `getProjectId()` (`render.ts:480`), but nothing reads these values to gate what a tag/bridge call
is allowed to fetch.

**Recommended structural fix (not point patches):** thread the render-time `workspaceId`/`projectId`
into every bridge/tag handler and add one shared "does this record's ancestor chain match the
caller's known-good workspaceId" check, rather than re-patching each call site as new ones are
discovered. Every finding below is currently a point-patch candidate at best; none of them, even once
fixed individually, close the structural gap.

## Provenance note: PR #10232 — RESOLVED, fully subsumed by `sec/sandbox-cross-tenant-fixes`

PR #10232 (`sec/sandbox-services-fixes` → `develop`, still `OPEN`/`mergedAt: null` as of last check)
was independently audited commit-by-commit against `sec/sandbox-cross-tenant-fixes`'s current tip
(see `git merge-base sec/sandbox-cross-tenant-fixes sec/sandbox-services-fixes` →
`a91f1056f3907d2d6d6e99c2fd41ae7a4a5aafc2`). Result: **every one of its 11 commits is either
byte-identical (patch-id confirmed) to a commit already in `cross-tenant-db-access-fixes`' history via
`develop`, or independently re-fixed with equivalent-or-stronger code on `sec/sandbox-cross-tenant-fixes`**
— confirmed by reading the actual current production logic (not commit messages or test titles) for
every item:

- secureReadFile symlink + path-separator-boundary hardening → `secure-read-file.ts` (both halves
  present).
- `response.getBodyBuffer` re-verification by id → `db-trust.ts`'s `readResponseBodyBufferOwned`
  (superset of PR #10232's fix).
- unknown-capability filtering + bundle-plugin full-module grant (C1) → `surface-profiles.ts`'s
  `effectiveGrant` (stricter — per-surface capability ceiling).
- capability-gated host bridge (C1) → `e4f4cd594` (PR #10222), confirmed to be PR #10232's own fix
  plus the capability-filter fix squashed together, nothing dropped.
- `String()`-coercion of id/parentId/key bridge args → `templating-worker-database.ts` (Finding 6,
  already tracked as Fixed below).
- `cloudCredential.update` reload-by-id → `db-trust.ts`'s `reloadCloudCredentialForTrustedUpdate`
  (Finding 4, already tracked as Fixed below).

Test coverage was audited the same way (test titles diffed, each apparent sec-only title checked
against current cross-tenant test files) — every sec-branch test case has an equivalent (often
renamed/expanded) case already on `sec/sandbox-cross-tenant-fixes`. No fixes or tests needed porting.

**Conclusion: PR #10232 / `sec/sandbox-services-fixes` can be treated as fully superseded by
`sec/sandbox-cross-tenant-fixes` — safe to close, pending the user's confirmation** (closing a
shared/remote PR is a shared-state action, not something this doc's audit does on its own).

---

## Still unfixed

### Finding 7 — legacy (sandbox-off) template-tag context has the same bare-lookup handlers, entirely ungated, including `cloudCredential`

**Files:**
- `packages/insomnia/src/plugins/index.ts:387-430` (`getPluginCommonContext`'s `util.models` branches:
  `request.getById`, `cloudCredential.getById`/`update`, `workspace.getById`,
  `oAuth2Token.getByRequestId`, `cookieJar.getOrCreateForParentId`, `response.getLatestForRequestId`/
  `getBodyBuffer`).
- `packages/insomnia/src/main/templating-worker-database.ts:887-898` (`plugin.executeBundlePluginTag`)
  and `:1002-1020` (`plugin.executeUserPluginTag`): both call `runPluginTag(...)` — which wires
  `getPluginCommonContext` directly — whenever `settings.templateTagSandboxEnabled` is `false`, the
  **default, shipped configuration**.

**Verified:** yes, read directly. Confirmed `runUserRequestHook`/`runUserResponseHook` (H1) and
`runUserAction` (A1) have no equivalent legacy branch — they always route through the sandbox
unconditionally — so this gap is specific to the oldest surface, template tags, which predate the
sandbox initiative and kept an un-sandboxed fallback for the toggle-off case.

Found while verifying Finding 4's fix (Item 0): the `cloudCredential.update`/`getById` reload+strip
protection added to `templating-worker-database.ts`'s `pluginToMainAPI` only guards the **sandboxed**
bridge path — and `credentials` is above `TEMPLATE_TAG_PROFILE.capabilityCeiling`
(`surface-profiles.ts`), so no template tag can ever reach `cloudCredential.*` through that bridge
regardless of manifest. The only way any template tag reaches `context.util.models.cloudCredential`
at all is through this legacy path — which applies **zero** capability gating, **zero** reload-by-id,
and **zero** ownership check, to every one of the handlers listed above.

**Consequence:** with the sandbox toggle in its default (off) state — no opt-in required — any
installed template-tag plugin (bundle or user, no manifest permissions needed at all, since this path
bypasses the profile/capability system entirely) can call
`context.util.models.cloudCredential.update({ _id: '<any-id>' }, { type: 'Settings', _id: 'x' })` or
`context.util.models.request.getById('<any-id>')` etc. directly against `services.*`, with the exact
same "bare `_id`/`parentId` lookup, no ancestor-chain check" root cause as every other finding in this
file — but reached through a third entry point this doc hadn't covered (Nunjucks-sandboxed bridge,
Liquid, and now this un-sandboxed legacy context), and the only one of the three that also exposes
`cloudCredential`.

**Not yet fixed — deliberately out of scope of the fixes applied so far**: this predates and is
structurally separate from Findings 1/4/5/6's fixes (all scoped to `templating-worker-database.ts`'s
bridge, `liquid-extension.ts`, `local-template-tags.ts`, `main/ipc/main.ts`) — none of those touch
`plugins/index.ts`. Fixing Finding 4/5/6 in the bridge does **not** close this path. Flagged to the
user for a scoping decision rather than silently expanded into this session's work.

**Update (confirmed empirically while smoke-testing Finding 1's fix):** this is not just theoretically
reachable — it is the code path that actually governs a *plugin* template tag's behavior on the real
request-Send flow whenever the sandbox toggle is off (the default), for `response.getBodyBuffer` at
least (instrumented and observed directly: `getPluginCommonContext`'s raw `getResponseBodyBuffer`
passthrough fired and leaked a different, real response's content when a Send-time probe tag paired a
real id with a forged `bodyPath`; the already-fixed QuickJS bridge only fires when the sandbox toggle
is on). This raises this finding's practical priority above where it was assessed: it is not a
secondary/legacy fallback rarely hit in practice — for template tags specifically, it appears to be
*the* path for ordinary Send-time execution today, sandbox off. Still flagged as out of scope per the
user's decision — recorded here so a future session revisiting priority has the stronger reachability
evidence, not just the structural read.

**Fix:** same shape as Finding 4/5's point patches and structural fix, applied to
`getPluginCommonContext`'s handlers instead of (or in addition to) the bridge's — reload-by-id +
strip identity fields for `cloudCredential.update`, and the same ancestor-chain check
`recordBelongsToCallerWorkspace` uses, threaded through this context builder too. Note this context is
shared by *bundle* plugins (first-party/trusted) and *user* plugins (untrusted) alike — a fix here
should not break legitimate bundle-plugin use (e.g. `external-vault`), so audit bundle-plugin callers
the same way Finding 5's fix did for the sandboxed path.

---

## Fixed

### Finding 2 — `response` local template tag: author-supplied id, no scope check

**File:** `packages/insomnia/src/common/templating/local-template-tags.ts` (`response` tag's `run()`,
~line 581).

**Verified:** yes, read directly.

```ts
const request = await context.util.models.request.getById(id);   // id = literal string from {% response 'body', 'req_xxx' %}
if (!request) { throw new Error(`Could not find request ${id}`); }
...
let response = await context.util.models.response.getLatestForRequestId(id, environmentId);
```

`id` is whatever request-ID string the *template author* types into the tag — not derived from
render context. Validation was bare existence (`if (!request) throw`) — never a check that the
resolved request's workspace matches the workspace currently rendering. Contrast with the
`cookie`/`request` tags nearby (same file, ~line 330-359 and ~891), which correctly use
`context.meta.requestId`/`meta.workspaceId` — auto-populated from render context, not
author-controlled — and were therefore already safe.

**Impact (pre-fix):** any template in any project/workspace could read the latest response body,
headers, or URL of any request anywhere in the local database, just by knowing/guessing its `req_...`
id. This is a built-in tag — no plugin required, no sandbox toggle relevant.

**Fixed by:** after loading `request` by `id`, resolving its ancestor chain via the existing
`context.util.models.request.getAncestors(request)` bridge method (the same method
`liquid-extension.ts`/`liquid-extension-worker.ts` already use for the `request` tag's `folder`
attribute — in the sandboxed-worker case this itself routes through
`templating-worker-database.ts`'s already-`db.withAncestors`-backed `'request.getAncestors'` handler),
finding the `Workspace` ancestor, and rejecting with the same not-found message
(`Could not find request ${id}`) unless it matches `context.meta.workspaceId` (the current render's
real, host-computed workspace — not author-controlled). Reusing the same message means a caller can't
distinguish "wrong workspace" from "doesn't exist."

**Unit test:** `packages/insomnia/src/common/templating/__tests__/local-template-tags.test.ts`, describe
block `response tag > cross-workspace scope check (Finding 2)` — three cases: a request that resolves
to a different workspace than the render context is rejected; a render context with no
`meta.workspaceId` to check against is rejected (fail closed); a request in the *same* workspace still
succeeds (regression guard against breaking the legitimate use case). Confirmed the first two cases
failed against unpatched source (via `git stash` on just this file) before the fix landed.

**Smoke test:** `packages/insomnia-smoke-test/tests/smoke/local-response-tag-cross-workspace-scope.test.ts`
(fixtures: `local-response-tag-cross-workspace-scope-victim.yaml`,
`local-response-tag-cross-workspace-scope-probe.yaml`) — imports two separate, unrelated single-request
collections from two separate files (so the reference is a genuine cross-workspace one, not an
in-batch import that the importer's own id-remapping could mask — import assigns each request a fresh
id, confirmed by reading it back live via `window.database.invoke`), sends the "victim" request to
persist a real response containing a marker string, then edits the unrelated "probe" request's body
(through the real body editor, not a direct DB write) to reference the victim's real, live id, and
reads the tag's real Live Preview. Confirmed it returned the victim's marker content against unpatched
source, and the not-found rejection after the fix. No plugin and no sandbox toggle are involved — this
is the most directly reachable of all the findings in this file, exercisable by anyone who can type a
built-in tag into a request body, including via an imported/shared collection from an untrusted source.

**Independent verification:** CONFIRMED — a fresh, independently-dispatched agent reverted only this
file via `git stash`, reproduced the leak (Live Preview showed the victim marker instead of a
rejection), restored the fix via `git stash pop`, confirmed the smoke test passed again, and confirmed
`git status`/`git stash list` were left exactly as found.

### Finding 5 — sandbox bridge's `models.read` handlers had no ancestor-chain check

**Files:** `packages/insomnia/src/main/templating-worker-database.ts` (`'request.getById'`,
`'request.getAncestors'`, `'workspace.getById'`, `'oAuth2Token.getByRequestId'`,
`'cookieJar.getOrCreateForParentId'`/`'getCookiesForUrl'`, `'response.getLatestForRequestId'`),
`packages/insomnia/src/templating/db-trust.ts`, `packages/insomnia/src/templating/sandbox/in-sandbox-bootstrap.ts`.

`models.read` is granted to every template-tag/hook/action-surface plugin with an empty manifest — the
profile floor, not something a plugin can decline or a reviewer can gate by omission. The handlers
behind it did a bare `_id`/`parentId` lookup with no check that the resolved record's workspace matched
the caller's own, so any installed plugin (template tag, request hook, or plugin action — all three
share these handlers) could read another workspace's request/response/cookie-jar/oAuth2-token data
just by knowing or guessing its id, with the sandbox toggle on and no manifest permissions required.

**Fixed by:** `recordBelongsToCallerWorkspace` (`templating/db-trust.ts`) walks a resolved record's
ancestor chain and compares its Workspace ancestor against the caller's own workspace id; every
affected handler calls it and falls back to its existing not-found shape (never throwing where it
didn't already) so a caller can't distinguish "doesn't exist" from "exists in another workspace." The
caller's workspace id is snapshotted into a primitive local in `in-sandbox-bootstrap.ts`'s
`__buildContext`, before any plugin code runs, so a plugin can't mutate its own trust anchor before a
bridge call. Request hooks and plugin actions previously ran with no workspace anchor at all despite
sharing these handlers — both were threaded a real one (hooks from the render context already
available; actions via a new `ExecutePluginActionArgs.workspaceId` field threaded from the three real
UI call sites through to the sandbox envelope).

**Detector:** `packages/insomnia/src/main/templating-worker-database-ancestor-surface.ts` — selects
every `models.read`-capability handler (not a hand-picked list, so a future handler is covered
automatically) and flags any that don't call `recordBelongsToCallerWorkspace`. Confirmed it flagged
all 7 handlers red against unpatched source, clean after the fix. Wired into `npm run sandbox:ancestor`
/ `sandbox:ancestor:test`.

**Unit tests:** `packages/insomnia/src/main/__tests__/templating-worker-database.test.ts` —
cross-workspace-rejection and same-workspace-success cases for all 7 handlers, plus dedicated cases
proving the hook and action paths actually receive the caller's workspace id. All confirmed red against
unpatched source before the fix.

**Smoke tests:** `packages/insomnia-smoke-test/tests/smoke/sandbox-ancestor-check-cross-workspace-scope.test.ts`
— one plugin exercising a template tag, a request hook, and a request action, each attempting to read a
real request from a separate, real workspace (two fixture files, so the reference is a genuine
cross-workspace id, not one an import batch's own id-remapping could mask). Confirmed all three
variants leaked the target's content against unpatched source, and reported `NONE` after the fix.
`sandbox-ancestor-check-cross-project-scope.test.ts` repeats the template-tag variant across two
separate local projects instead of two workspaces in one project, confirming identical results — the
underlying check never walks past `Workspace`, so a project (or organization) boundary can't hide a
scoping gap the workspace-level test wouldn't already catch.

**Independent verification:** CONFIRMED — a fresh, independently-dispatched agent reverted only the
implementation files via `git stash`, reproduced the leak, restored via `git stash pop`, confirmed the
smoke test passed again, and confirmed the working tree was left exactly as found.

### Finding 1 — `liquid-extension.ts` duplicates the bare-lookup pattern across every handler, unpatched

**File:** `packages/insomnia/src/templating/liquid-extension.ts` (`createLiquidTag`'s `models` object).

**Fixed by:** extracted the same protection patterns already proven on the Nunjucks bridge
(`main/templating-worker-database.ts`) into a new shared, side-effect-free module,
`packages/insomnia/src/templating/db-trust.ts` — `assertResponseBodyPathReadOwnership`,
`readResponseBodyBufferOwned` (id-reload-when-available, falling back to bodyPath ownership), and
`reloadCloudCredentialForTrustedUpdate` (reload-by-id + strip `_id`/`type`/`parentId`) — and had both
`templating-worker-database.ts` and `liquid-extension.ts` import the same functions, so there are now
two call sites but one implementation. `liquid-extension.ts`'s `models.request.getById`,
`workspace.getById`, `oAuth2Token.getByRequestId`, `cookieJar.getOrCreateForParentId`,
`cookieJar.getCookiesForUrl`, `response.getLatestForRequestId`, and `cloudCredential.getById` now wrap
their id-like argument in `String(...)` before it reaches `services.*` (mirroring Finding 6);
`cloudCredential.update` and `response.getBodyBuffer` now call the shared helpers above instead of
forwarding straight to `services.*`. A shared module was chosen over importing
`templating-worker-database.ts` directly to avoid a real circular import
(`templating-worker-database.ts` → `~/plugins` → `templating/index.ts` → `liquid-extension.ts`) and to
avoid pulling that file's Electron main-process-only imports (`app`/`BrowserWindow`/`dialog`/`shell`)
into a file bundled into other processes too.

**Detector:** `packages/insomnia/src/templating/liquid-extension-parity-surface.ts`
(`describeLiquidParitySurface`/`findUnprotectedLiquidModelKeys`) — captures the *real* `models` object
built by a real `createLiquidTag` render (via a real Liquid engine + a capturing tag, never a
reimplementation) and source-scans each tracked function for its expected protection marker
(`String(...)` for the coercion family; the shared helper's name for `cloudCredential.update` and
`response.getBodyBuffer` — checking for the helper's name, not just "some structurally similar patch",
keeps this honest about "the same code path" per the audit plan's "reuse the exact pattern" guidance).
One non-obvious wrinkle the detector had to account for: `services.*` is a lazily-resolved `Proxy`
(`packages/insomnia-data/src/services/index.ts`) whose generic dispatcher closure happens to contain
the literal text `String(serviceName)`/`String(methodName)` for its own error messages — a naive
`/String\(/` scan over a *bare, unpatched* `services.request.getById` reference therefore
false-negatives ("looks protected" when it's actually a pass-through). Fixed by first recognizing that
dispatcher's own distinctive error text and treating it as unprotected regardless of the incidental
match. Run against unpatched source first: correctly flagged all 9 tracked keys (confirming the
detector actually catches the bug, not just asserts a shape); flags none after the fix. Wired into
`npm run sandbox:liquid-parity` / `sandbox:liquid-parity:test` in `packages/insomnia/package.json`.

**Unit test:** `packages/insomnia/src/templating/__tests__/liquid-extension.test.ts` — drives the real
`createLiquidTag` through a real Liquid engine + real render (mocking only `insomnia-data`), asserting
each of the 9 protections individually (coercion for the 7 id-like methods; reload+strip behavior for
`cloudCredential.update`, including the unknown-id-rejects and identity-fields-stripped-even-when-
supplied cases; the id-reload-ignores-forged-bodyPath and no-id-falls-back-to-ownership-check cases for
`response.getBodyBuffer`). Confirmed all 12 cases fail against unpatched source (reverted via `git
stash` on just `liquid-extension.ts`), pass after the fix.

**Smoke test: not added — reachability turned out to be more complicated than assumed, see below.**
The original assumption (this doc's prior write-up) was that any plugin's `{% tag %}` calling
`context.util.models.*` on the real request-Send path would
exercise this file's `models` object directly, regardless of the sandbox toggle. Empirically (traced by
instrumenting the real running app, not just reading source) that is **not** what happens for plugin
template tags: `ui/templating/worker.ts`'s `fetchAndRoutePluginTags` unconditionally overwrites every
plugin tag's `run` to call `'plugin.executeUserPluginTag'`/`'plugin.executeBundlePluginTag'` over the
templating-worker-database bridge, regardless of which engine (`createLiquidTag`/`createLiquidTagWorker`)
dispatched the tag — so a plugin tag's Send-time behavior is actually governed by
`plugin.executeBundlePluginTag`/`executeUserPluginTag` (`templating-worker-database.ts`), which itself
branches on `settings.templateTagSandboxEnabled`: sandbox **on** → `runPluginTagInSandbox` (the
QuickJS/`host-bridge.ts` path, already protected); sandbox **off** → `runPluginTag` →
`getPluginCommonContext` (`plugins/index.ts`) — **Finding 7's already-documented, deliberately
out-of-scope legacy context**, not this file. Confirmed directly: instrumenting both
`getPluginCommonContext`'s `response.getBodyBuffer` and this fix's `readResponseBodyBufferOwned` and
driving a real Send showed `getPluginCommonContext`'s version fire (and leak) for the sandbox-off case,
while sandbox-on invoked the already-fixed QuickJS bridge — `liquid-extension.ts`'s own wrapper never
fired for either. This means: (a) the real-world severity of this specific file, for *plugin* template
tags, is lower than originally assessed — Finding 7 is the actual governing path today, which raises
Finding 7's priority rather than this one; (b) it's still unclear whether *any* real, user-triggerable
flow exists where `liquid-extension.ts`'s own `models` object is the code path that determines a
user-visible outcome (candidates not yet checked: built-in/local tags such as the `response` tag in
`local-template-tags.ts`, which are not plugin-sourced and so may not be subject to
`fetchAndRoutePluginTags`'s override; non-Send render contexts). The fix is kept as defense-in-depth on
a file confirmed (by the parity detector, driving a real render) to build an unprotected `models`
object — but per the user's explicit decision, no Send-based Playwright smoke test was written this
session while this reachability question is open, mirroring Item 0's "no realistic plugin-triggerable
path" precedent for skipping a smoke test.

**Related, newly-noticed file — not part of this fix, recorded for a future pass:**
`packages/insomnia/src/common/templating/liquid-extension-worker.ts`'s `createLiquidTagWorker` builds
its own near-identical, equally protection-free `helperContext.util.models` object — but per the
`fetchAndRoutePluginTags` override above, that object's methods are **never actually invoked** for
plugin tags (`ext.run` is replaced before any tag runs), making it dead code for the plugin-tag case.
Whether it's live for some other (non-plugin) tag shape wasn't checked. Left unfixed and unrecorded as
its own finding, since it doesn't appear reachable today — noted here only so a future review doesn't
mistake it for an unfixed instance of Finding 1 without first checking reachability.

### Finding 6 — Missing `String(...)` coercion on `id`/`parentId`/`key` bridge args: Mongo-operator injection

**File:** `packages/insomnia/src/main/templating-worker-database.ts` — every bare-id handler
(`'request.getById'`, `'workspace.getById'`, `'oAuth2Token.getByRequestId'`,
`'cookieJar.getOrCreateForParentId'`, `'cookieJar.getCookiesForUrl'`,
`'response.getLatestForRequestId'`, `'cloudCredential.getById'`, `'pluginData.hasItem'`/
`'pluginData.getItem'`/`'pluginData.removeItem'`) passed its caller-supplied
`body.id`/`body.parentId`/`body.key`/`body.requestId`/`body.environmentId` straight into the NeDB
query with no coercion. `'pluginData.setItem'`'s `body.key` had the identical gap — not in this
finding's original write-up, but caught by the dynamic detector built for the fix (see below), which
enumerates every handler programmatically rather than checking a fixed list.

**Verified:** yes, read directly, and reproduced live end-to-end through the real running app: a
zero-permission template tag calling `context.util.models.request.getById({ $ne: null })` (with "Run
template tags in sandbox" on) returned a real, unrelated request's `_id` — `LEAKED:req_<id>` — instead
of failing "not found." NeDB (a MongoDB-style query engine) interprets an object like `{ $ne: null }`
as a query operator (`{ _id: { $ne: null } }`, matching any document with a non-null `_id`) rather
than a literal value when it reaches `db.findOne`/`db.find` unstringified, letting a crafted "id"
match **any** document instead of one specific one.

**Fixed by:** wrapping every one of these arguments in `String(...)` before it reaches the service
call, e.g. `services.request.getById(String(body.id))`. This does not by itself fix the deeper
ownership-check gap (Root Cause above, tracked by Finding 5) — it only prevents the
operator-injection variant of it.

**Detector:** `packages/insomnia/src/main/templating-worker-database-coercion-surface.ts`
(`findHandlersMissingIdCoercion`/`describeCoercionSurface`) — a source-scanning, balanced-paren-aware
detector that parses every `services.*(...)` call site in each handler's compiled source and flags any
`id`/`parentId`/`key`/`requestId`/`environmentId`-named argument not wrapped in `String(...)`. Run
against unpatched source first: flagged all 11 handlers above (the plan's 8 plus `pluginData.setItem`).
Wired into an enforced test (`templating-worker-database-coercion-surface.test.ts`) plus
`npm run sandbox:coercion` / `sandbox:coercion:test` in `packages/insomnia/package.json`.

**Unit test:** `packages/insomnia/src/main/__tests__/templating-worker-database.test.ts`, describe
block `id-like bridge arguments are coerced to String before reaching services.* (Finding 6)` — drives
every one of the 11 handlers through the real `runPluginTagInSandbox`, passing `{ $ne: null }` in place
of the id-like argument, and asserts the mocked service function receives the coerced string
`'[object Object]'`. Confirmed failing (raw object received) against unpatched source before the fix.

**Smoke test:** `packages/insomnia-smoke-test/tests/smoke/template-tag-id-argument-coercion.test.ts` —
installs a zero-permission plugin whose tag calls
`context.util.models.request.getById({ '$ne': null })`, enables the sandbox via the real Preferences
UI, and asserts the Live Preview reports `NOT_FOUND`. Against unpatched source it instead reported
`LEAKED:req_<a real, different request's id>` (confirmed twice, with two different leaked ids across
retries, ruling out a flaky/unrelated failure) — reran clean after the fix.

**Independent verification:** CONFIRMED — a fresh, independently-dispatched agent reproduced the leak
by reverting only the fix (`git stash` on the one file), observed two different real request ids leak
across a retry, restored the fix, and confirmed the smoke test passes again with the working tree back
to its exact prior state.

### Finding 4 — `cloudCredential.update`: no reload-by-id, no identity-field stripping

**Files:**
- `packages/insomnia/src/main/templating-worker-database.ts` (`'cloudCredential.update'` handler)
- `packages/insomnia-data/node-src/services/cloud-credential.ts:14-16` (`services.cloudCredential.update`)

**Verified:** yes, read directly. The bridge handler forwarded `body.originCredential` (a full,
caller-supplied document, not reloaded by `_id`) and `body.patch` straight through to `docUpdate`,
with no allowlist of patchable fields — a caller supplying an arbitrary `originCredential._id` could
get that document patched with whatever `patch` it supplied, including `_id`/`type`/`parentId`
themselves.

**Fixed by:** reloading the credential server-side by `originCredential._id` via
`services.cloudCredential.getById` (rejecting if not found), and stripping `_id`/`type`/`parentId`
from `patch` before calling `services.cloudCredential.update` — mirroring the `resolveTrustedPlugin`
pattern already used elsewhere in this file.

**Reachability note:** this handler sits behind the `credentials` capability
(`host-bridge.ts`'s `BRIDGE_PATH_CAPABILITIES`), which is above `TEMPLATE_TAG_PROFILE`'s capability
ceiling (`surface-profiles.ts`) — no user template tag, hook, or action can ever be granted it,
sandbox on or off. The only sandboxed caller that reaches this handler with `credentials` granted is
a first-party bundle plugin (`plugin.executeBundlePluginTag` grants `ALL_CAPABILITIES`). See Finding
7 below for the *actually* reachable-by-any-plugin path to this same data (the legacy sandbox-off
context), which this fix does not address.

**Test:** `packages/insomnia/src/main/__tests__/templating-worker-database.test.ts`, describe block
`cloudCredential.update reloads by id and strips identity fields from the patch` — drives the real
`runPluginTagInSandbox` (real sandboxed bridge, not a raw handler stub) three ways: (1) no
`credentials` capability granted → `context.util.models.cloudCredential` is `undefined` entirely; (2)
granted, unknown id → rejected, `services.cloudCredential.update` never called; (3) granted, known id
→ the re-loaded server-side document is passed to `update`, and `type`/`_id`/`parentId` are stripped
from the patch even though the caller supplied them. Confirmed failing against unpatched source
(cases 2 and 3) before the fix landed.

**Smoke test:** not added — the only realistic caller with the `credentials` capability is a
first-party bundle plugin, which isn't user-installable content a Playwright smoke test can exercise
as ordinary plugin input; the vitest test above already drives the real sandbox bridge end-to-end for
both the denied and granted cases, which is the actual reachability boundary for this specific
handler.

### Finding 3 — `services.invoke`: generic cross-service RPC gateway, no ownership check

**Files (original vulnerability):**
- `packages/insomnia/src/main/ipc/main.ts:398-407` (handler, now deleted)
- `packages/insomnia/src/entry.preload.ts:549-554` (exposed to renderer as `_dataServicesInvoke`)

**Verified:** yes, read directly.

```ts
ipcMainHandle('services.invoke', async (_, serviceName, methodName, ...args) => {
  const service = services[serviceName as keyof Services];
  if (!service) { throw new TypeError(...); }
  const fn = service[methodName as keyof typeof service];
  if (typeof fn !== 'function') { throw new TypeError(...); }
  const result = await (fn as (...args: unknown[]) => unknown).call(service, ...args);
  return Buffer.isBuffer(result) ? new Uint8Array(result) : result;
});
```

This was a fully generic pass-through: any caller could invoke **any method on any `insomnia-data`
service with arbitrary arguments** — e.g. `window._dataServicesInvoke('request', 'getById',
'req_from_another_org')` behaved exactly like calling the service directly. There was no per-call
authorization at this layer; it was a blanket RPC gateway with zero allowlisting or capability gating
(unlike the templating bridge's `host-bridge.ts`).

**Fixed by:** full named-handler migration, not an allowlist — every legitimate `(serviceName,
methodName)` pair got its own purpose-built `ipcMainHandle('services.<serviceName>.<methodName>',
...)` handler, and the generic reflection-based gateway was deleted outright once nothing legitimate
called it anymore (chosen over an allowlist wrapped around the existing dispatcher, since a wrapper
still leaves the dangerous reflection-based dispatch mechanism live in the codebase for a future bug
to reintroduce, where deletion removes the mechanism itself).

**Status, branch `sec/sandbox-cross-tenant-fixes` — Phase 4 complete, verified:**
- Phases 0-2: all 183 real `(serviceName, methodName)` pairs enumerated by a source-scanning detector
  (`services-invoke-surface.ts`) and given named handlers.
- Phase 3: `'services.invoke'`'s body replaced with a tripwire throw (commit `5dc441b17`). Running the
  full Playwright smoke suite against the tripwire surfaced two real dynamic-dispatch misses the
  static detector couldn't see on its own (a variable-held service reference, and a call site with a
  generic type argument between the method name and its parens) — both fixed with named handlers of
  their own (`81f94ea48`, `1224da000`).
- Smoke-suite verification: the 5 previously-unconfirmed flaky/failed results from that run were
  individually re-run in isolation with CI-parity timeouts (`--timeout=60000`) and root-caused — none
  were services.invoke regressions:
  - `external-vault-integration.test.ts` — confirmed timeout artifact, passed cleanly in isolation.
  - `git-sync.test.ts:108` (push committed changes) — confirmed pre-existing flake (fails once on a
    modal-overlay click race, passes on the suite's own configured retry); not a regression.
  - `git-sync.test.ts:190` (editing collection name) — also flaky, different symptom than originally
    observed (a client-side dialog-reopen timing race unrelated to any `services.*` call), passes on
    retry; not a regression.
  - `preferences-interactions.test.ts:16` and `:43` (AI URL settings) — fail deterministically, but
    root-caused to a local-environment gap, not a code regression: the "AI Settings" tab is gated on
    the bundled `@kong/insomnia-plugin-ai` plugin being installed, which requires a `NODE_AUTH_TOKEN`
    for the private `@kong` GitHub Packages scope that isn't set in this checkout. CI presumably has
    that token and would install the real plugin.
  - The remaining 56 smoke-test files (~150 individual test assertions, covering the "43 never ran"
    backlog from the prior session's globalTimeout-truncated run) were batch-run (12 batches of 5-10
    files each, `--timeout=60000`) — all passed. Three batches logged a "Worker teardown timeout"
    (Playwright's own not-attached-to-any-test category) correlated with hidden-`BrowserWindow`-heavy
    tests (`plugin-bridge.test.ts`, `pre-request-script-window.test.ts`,
    `sandbox-template-tags.test.ts`) — never caused a test failure, architecturally unrelated to
    `services.invoke`, not investigated further (worth a look in a future session if it recurs).
  - `npm test -w packages/insomnia` stayed green throughout (149 files, 2428 passed, 14 pre-existing
    skips, 0 failed).
- Phase 4: `'services.invoke'`'s `ipcMainHandle` registration and its `HandleChannels` entry were
  deleted from `main/ipc/main.ts` / `main/ipc/electron.ts`; the two renderer-side callers
  (`entry.preload.ts`'s `_dataServicesInvoke`, `ui/renderer-services-proxy.ts`'s `servicesProxy`)
  dropped their now-dead fallback branch to that channel; `resolveServicesInvokeChannel`
  (`migrated-services-invoke-pairs.ts`) now throws for any pair without a named handler instead of
  routing it to the (deleted) generic gateway, preserving the tripwire's loud-failure property with no
  live reflection dispatch left to fail into. Commit `afc1ec1f6`.
- **`createServicesProxy` (`ui/services-proxy.ts`) was deliberately kept, not deleted** — despite the
  migration plan's original wording naming it alongside `services.invoke`/`_dataServicesInvoke` for
  removal. It is not part of the insecure gateway: it is the mechanism that reconstructs the
  renderer's `services.*` proxy object client-side from named per-pair IPC channels (every ordinary
  `services.request.getById(...)`-shaped call site still goes through this proxy shape, just now
  targeting a named channel instead of the old reflection dispatch). `entry.client.tsx`,
  `entry.hidden-window-preload.ts`, and `entry.plugin-window.ts` all depend on it directly; deleting it
  would have broken the build and every one of those call sites. Only the actual generic-dispatch
  gateway (`main.ts`'s handler) and the dead `'services.invoke'`-channel fallback branches were removed.
- Full `npm test -w packages/insomnia`, `npm run lint`, and `npm run type-check` all re-run clean after
  the Phase 4 deletion — no other code referenced the deleted symbols.

_Findings move here from "Still unfixed" once verified patched; they are never deleted.__

---

## Lower-severity restatements of the same pattern (same file: `main/ipc/main.ts`, and `main/ipc/grpc.ts`)

Not separately exploit-proven beyond "bare existence check, no workspace/org match" — listed for
completeness, lower priority than Findings 1-6 above:

- `main/ipc/main.ts` HAR export handlers (`exportHarWithRequest`/`exportHarCurrentRequest`,
  ~lines 563-580): `services.request.getById(options.requestId)`,
  `services.response.getById(options.responseId)` — existence check only.
- `main/ipc/main.ts:392-394` (`database.caCertificate.create`): `parentId` passed straight through to
  `services.caCertificate.create` with no check that the parent workspace belongs to the caller.
- `main/ipc/grpc.ts` (~lines 77, 97-99, 111, 327): `services.protoFile.getById(protoFileId)`,
  `loadMethods(requestId)` — renderer-supplied ids, bare lookups, no workspace scoping.

## Confirmed NOT vulnerable (checked, no action needed)

- Pre-request/after-response scripts (`insomnia-sdk` / `packages/insomnia-scripting-environment`): the
  `insomnia` object (`environment`, `collectionVariables`, `vault`, `cookies`, `variables`, folders)
  operates entirely on plain in-memory data pre-resolved into `RequestContext` before the isolate runs
  (`packages/insomnia/src/network/network.ts` builds this ~line 650 onward, consumed by
  `packages/insomnia/src/scripting/run-script.ts`). No host function takes a script-supplied id into
  `models.*`/`services.*`. (`insomnia.sendRequest()` is a real network-egress/SSRF surface since the
  URL is script-controlled, but that's a different bug class, not a NeDB/cross-workspace data leak.)
- `network.ts` internal fetch helpers (`fetchRequestGroupData`, `fetchMcpRequestData`, ~lines
  113-249): use `services.*.getById` but only with internally-supplied ids (the request/mcpRequest
  actually being executed), and correctly derive workspace via `db.withAncestors`/`parentId` before
  scoping environment/cookieJar/certs. No template/script-controllable input reaches these.

## Not yet reviewed — open areas for follow-up

Not examined in any pass so far and may harbor the same "bare `_id`/`parentId` lookup, no ownership
check" pattern. Listed so a follow-up review doesn't skip them, not because a problem is confirmed:

- **`packages/insomnia/src/main/ipc/*.ts` handlers not yet audited** — coverage so far is `main.ts`
  and `grpc.ts` only. Other IPC files in that directory (e.g. import/export, mock-server/mock-route,
  proto-directory, sync/git handlers, secret-storage) have not been checked for the same
  generic-lookup pattern.
- **Whether plugin/template code runs in a separate `BrowserWindow`/webview with its own (possibly
  more restricted) preload, or shares the main renderer's preload** — determines real-world
  exploitability of Finding 3 (`services.invoke`) from a plugin/template context specifically, vs.
  only from first-party renderer code. Needs confirmation in Electron main-process window/webview
  setup (`packages/insomnia/src/main/` window creation code, `entry.plugin-window.ts` and its
  corresponding preload, if a distinct one exists).
- **`insomnia-sdk` network egress (`insomnia.sendRequest()`)** — flagged above as a distinct bug class
  (SSRF-style network egress, not NeDB access) but not investigated in depth; a script in one project
  could potentially reach internal/other-project-configured endpoints. Out of scope for this doc's
  cross-tenant-DB-access focus, worth a separate pass.
- **GraphQL/WebSocket/Socket.IO/MCP request-type-specific code paths** beyond
  `fetchRequestGroupData`/`fetchMcpRequestData` — not exhaustively checked for their own independent
  id-based lookups outside the common bridges covered here.
- **`insomnia-inso` (CLI) and `insomnia-testing` packages** — coverage so far is entirely the Electron
  app (`packages/insomnia`); the CLI/test-runner packages may have their own template/script execution
  paths with separate (or shared) DB access code that hasn't been looked at.
- **Sync/git-backed workspaces** (`packages/insomnia/src/sync/`) — whether a git-backed project's
  local NeDB mirror has any additional cross-repo/cross-project blending risk when templates render
  against synced data was not examined.
