# Security review — PR #10286 (H1, "route user-plugin response hooks through the sandbox (PR 10b)")

## Context

This PR is Phase 2, ticket H1's response-hook half (request hooks landed as PR 10a, #10290,
already reviewed in `H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md`). It adds:
`__buildResponseApi` in the sandbox bootstrap (getters + `getBody()`/`getBodyStream()`/`setBody()`),
a new `response.setBody` host bridge handler (base64-decode → bounded `fs.writeFileSync`), and a new
`plugin.runUserResponseHook` protocol-dispatch handler mirroring the already-fixed
`plugin.runUserRequestHook`. Checked against the migration plan gist (fetched fresh this run): H1
(PR 10) depends on C1/C2 (bridge capability gating, capability-aware context) and L1 (PR 9, stop
in-process module load); it precedes A1 (PR 11, plugin actions via the bridge — not yet landed) and
T1 (PR 12, trust-model flip). Both request and response hooks are one ticket (H1) per the plan; this
PR completes it.

This review traced the new response-hook-specific code (`runResponseHookInSandbox`,
`pickHookResponseFields`, the `response.setBody` bridge handler, `__buildResponseApi`) against the
bug classes already proven out by prior reviews in this directory: unchecked dispatch entry,
unsanitized marshal-boundary merges, bare-lookup ownership gaps, raw-native reachability, and
reference-identity leaks.

## Finding 1 — `plugin.runUserResponseHook` trusts the caller-supplied `response`/`bodyPath`, letting a forged call redirect `setBody`'s write to a different response's on-disk file (Medium)

**Files:**
- `packages/insomnia/src/main/templating-worker-database.ts:864-878` (`plugin.runUserResponseHook`
  dispatch), `:514-546` (`runResponseHookInSandbox`), `:501-509` (`pickHookResponseFields`),
  `:611-628` (`response.setBody` bridge handler)
- `packages/insomnia/src/templating/sandbox/in-sandbox-bootstrap.ts` (`__buildResponseApi`'s
  `setBody`, closing over `resp.bodyPath`)

**Verified:** yes — reproduced with a passing regression test (see below), and independently
confirmed by two rounds of sub-agent source tracing plus a dedicated adversarial-verification pass
that tried and failed to refute it.

`plugin.runUserResponseHook` was authored on top of the already-fixed permissions-trust bug
(`H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md` Finding 1): it correctly calls
`resolveTrustedPlugin(body.plugin.name)` and uses the registry's `directory`/`permissions`, never
the caller-supplied copies. But the *response* object — including `bodyPath`, the on-disk file
`context.response.setBody()` will write to — is passed straight through unchanged:

```ts
const trusted = await resolveTrustedPlugin(body.plugin.name);
return runResponseHookInSandbox(
  { ...body.plugin, directory: trusted.directory, permissions: trusted.permissions },
  body.hookIndex,
  body.response,        // <-- caller-supplied, never validated against a real response document
  body.renderedRequest,
  body.renderContext,
);
```

`pickHookResponseFields` copies `bodyPath` verbatim into the envelope; the sandbox bootstrap's
`setBody` closes over that value and bridges it to the host `response.setBody` handler, which
validates only that the resolved path stays *within* the app's `responses/` directory
(`path.resolve`/`path.relative` containment) — it never checks that the path belongs to the specific
response the caller claims to be processing. So a forged `plugin.runUserResponseHook` call naming any
real, installed plugin that has a response hook (no malicious plugin code required — a benign
body-transforming hook suffices) can supply a `response.bodyPath` pointing at a *different* response's
body file elsewhere in the same directory, and that other response's on-disk content gets overwritten
with whatever the named hook writes.

This is the write-side counterpart of the already-documented, read-only bodyPath-trust gap in
`CROSS-TENANT-DB-ACCESS-FINDINGS.md` Finding 1 (`response.getBodyBuffer` trusts `body.response`
verbatim with no reload-by-id, and in fact has no path-containment check at all — worse in that
narrow respect, but read-only). This finding is new in kind, not a restatement: the write primitive
(`response.setBody`) did not exist before this PR, and unlike request-hook mutations (in-memory
fields only), a response hook's `setBody()` performs a real filesystem write — a materially different
consequence (cross-response data corruption vs. cross-response data disclosure).

**Reachability today:** requires the per-session templating-db auth token (F1, already fixed —
not reopened by this finding). Per the project's own established threat model
(`H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md` Finding 1), the realistic actor holding that token
today is a user plugin's *action* — still un-sandboxed/full-Node until ticket A1 lands — the identical
actor already accepted as in-scope for the sibling `permissions`-forgery finding. That same actor also
already has bridge access to `response.getLatestForRequestId` (no ownership check either) to look up a
victim response's real `bodyPath` directly, so "guessing" the target path is not a meaningful barrier.
Not "future work": A1/T1 aim to route actions through the *sandboxed, capability-gated* path, and
`response.setBody` is gated at only the `models.read` baseline (granted to every plugin, capabilities
or not) — so once actions are sandboxed, this gap hands a fully-capability-restricted plugin a
cross-tenant write primitive the ceiling was never designed to grant.

**Consequence:** integrity violation — any response document's saved body, anywhere in the local
`responses/` directory (not scoped to the current workspace/project/render), can be overwritten by a
forged protocol call, independent of which plugin/hook is legitimately running.

**Fix:** mirror the F2'/permissions pattern already applied to `directory`/`permissions` in this same
handler — resolve or verify the response against a trusted, caller-independent source (e.g., reload by
`parentId`/environment via `services.response.getLatestForRequestId` and use *that* document's
`bodyPath`, or bind the hook invocation to a server-held reference to the response actually being
rendered) rather than trusting `body.response` wholesale.

**Test:**
`packages/insomnia/src/main/__tests__/templating-worker-database-protocol-authorization.test.ts`,
describe block `plugin.runUserResponseHook trusts caller-supplied 'response.bodyPath', not tied to the
response being rendered` — three cases: a baseline call (real bodyPath) writes correctly and leaves
other files untouched; a forged call naming a *different* response's bodyPath (still contained within
`responses/`) overwrites it — passing today documents the bug, not the desired behavior, mirroring how
the existing `permissions`-forgery regression test was written before its fix landed; and a bodyPath
that escapes `responses/` entirely is still correctly blocked (the pre-existing containment guard is
not affected by this finding).

## Finding 2 — `response.setBody`'s containment check has no symlink/realpath re-check (Low, defense-in-depth)

**Files:** `packages/insomnia/src/main/templating-worker-database.ts:611-628` vs. the sibling
`getPluginEntrySource`/`readPluginModuleMap` containment checks two functions above it in the same
file, which explicitly re-verify via `fs.realpathSync` "since a symlinked entry can point outside
base."

**Verified:** by reading, not reproduced — no primitive in the current codebase lets a caller plant a
symlink inside `responses/`, so this is not independently exploitable today.

Unlike its sibling containment checks in this same file, the `response.setBody` handler's
`path.resolve`/`path.relative` check does not re-verify via `fs.realpathSync` after resolution. If a
pre-existing symlink inside `responses/` ever pointed outward (via a future bug, a manual filesystem
edit, or an OS-level TOCTOU), a write through it would follow the symlink and land outside the
directory the containment check is meant to enforce. Recorded as defense-in-depth debt, matching the
established pattern in the rest of this file, rather than a currently-reachable bypass.

**Fix (optional, low priority):** after the relative-path check, additionally verify
`fs.realpathSync(path.dirname(target))` stays within `fs.realpathSync(responsesDir)` before writing —
mirroring `getPluginEntrySource`'s existing pattern.

## Excluded from this review

- **Auth-token bypass (F1), `directory` trust (F2'), and the general `stripDangerousKeysReviver`
  asymmetry (F3)** — already found and fixed on this branch's ancestor
  (`H1-HOOK-CONTROL-BYPASS-REMEDIATION-PLAN.md`), and re-verified as still correctly applied to the
  new response-hook path (`runResponseHookInSandbox` applies `stripDangerousKeysReviver` at the same
  point as the request-hook path; `resolveTrustedPlugin` covers both hook dispatchers symmetrically).
  Not re-reported.
- **`permissions`-trust bypass** — already found and fixed
  (`H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md` Finding 1). Confirmed `plugin.runUserResponseHook`
  does *not* reintroduce this bug (it resolves `permissions` from the trusted registry, same as
  `plugin.runUserRequestHook`). Not re-reported.
- **`response.getBodyBuffer`'s pre-existing, unbounded `bodyPath` read trust** — this handler is
  unchanged by this PR (not part of its diff); the same root cause is already recorded in
  `CROSS-TENANT-DB-ACCESS-FINDINGS.md` Finding 1. Note for a future reader: that doc states
  `templating-worker-database.ts`'s copy of this bug "was fixed by #10232," but the handler as it
  exists in this branch (`response.getBodyBuffer` at `templating-worker-database.ts:602-607`) still
  forwards `body.response` unvalidated into `getResponseBodyBuffer`, which reads whatever `bodyPath` is
  given with no containment check at all — the prior doc's "fixed" framing for this specific file
  appears stale (the same kind of stale-scoping-note problem `H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md`
  and `SANDBOX-CAPABILITY-AUDIT-PLAN.md` each already flagged once for other docs). Left as-is since
  fixing pre-existing, out-of-diff code is outside this review's scope — recorded here only so a
  future reviewer doesn't rely on the stale "fixed" claim.
- **Plugin actions still executing un-sandboxed/full-Node** — ticket A1 (PR 11), not yet landed; the
  plan's own execution-surface table already tracks this as the mechanism by which Finding 1 above is
  reachable today. Not reported as a new gap of this PR — it's the existing, already-acknowledged
  threat model, same actor `H1-FOLLOWUP-PERMISSIONS-TRUST-SECURITY-REVIEW.md` already used.
- **`getBodyStream()` throwing in the sandbox** — an intentional, documented behavior difference (PR
  description's "Note on scope"), not a security control; out of scope for this review.

## Hypotheses chased down and ruled out

- **Read-only `context.request` in a response hook, bypassed via the marshaled-back result** — ruled
  out. `__buildRequestApi`'s read-only branch deletes mutator methods entirely rather than leaving them
  present-but-inert, and no caller (`invoke-method.ts`/`network-adapter.node.ts`) merges a
  sandbox-returned "request" field back onto the live request for the response-hook path — only
  `response` fields are merged (`Object.assign(newResponse, mutated)`). The read-only claim holds
  structurally, not just by convention.
- **`stripDangerousKeysReviver` missing on the new response-hook re-entry point** — ruled out;
  `runResponseHookInSandbox` applies it at the same point the request-hook path does
  (`JSON.parse(json, stripDangerousKeysReviver)`), so the already-fixed F3 pattern was correctly carried
  over to the new code.
- **`response.setBody`'s capability requirement (`models.read`, baseline) unintentionally broadens
  what an ungated plugin can do vs. the pre-sandbox in-process behavior** — ruled out. The existing
  in-process response-hook `setBody` (`packages/insomnia/src/plugins/context/response.ts`) already
  performs an unconditional `fs.writeFileSync` with no permission check at all; gating the sandboxed
  equivalent at baseline reproduces, rather than expands, existing behavior.
- **`bodyPath` reachable/forgeable by the sandboxed plugin *script* itself (not just a forged protocol
  caller)** — ruled out. `__buildResponseApi` closes over the host-supplied `resp` object and exposes
  no setter for `bodyPath`; a plugin's own hook code cannot redirect its own write target, only a
  forged *caller* of the protocol dispatch (Finding 1's actual mechanism) can.
- **Case-insensitive-filesystem or null-byte bypass of the `response.setBody` containment check** —
  ruled out; `path.relative`'s `..`/absolute-path check is unaffected by casing, and `fs.writeFileSync`
  throws on an embedded NUL rather than truncating a path unexpectedly.
- **A second, unauthenticated protocol dispatch path bypassing F1 specifically for the new
  `response.setBody`/`plugin.runUserResponseHook` entries** — ruled out; both are registered only in
  `pluginToMainAPI`, dispatched exclusively through `resolveDbByKey`'s single auth-token check, same as
  every other entry (re-verified via the existing dynamic "every registered path" test, which now also
  covers these two new paths automatically).

## Verification

```
npm test -w packages/insomnia -- templating-worker-database-protocol-authorization
npx eslint packages/insomnia/src/main/__tests__/templating-worker-database-protocol-authorization.test.ts
cd packages/insomnia && npx tsc --noEmit
```

All green as of this review: 14/14 tests in the touched suite (11 pre-existing + 3 new), lint clean,
type-check clean.
