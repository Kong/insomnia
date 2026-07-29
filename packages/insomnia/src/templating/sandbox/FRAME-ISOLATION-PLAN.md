# Plan: harden the Electron renderer against XSS impact, in two sequenced tracks

**Status:** Not started. Working-tree-only, never committed, per this review's standing MD file
lifecycle rules. Self-contained: a fresh agent with no memory of prior conversation should be able to
pick this up from this file alone.

**Origin:** this plan started as a narrower proposal — frame-isolate a handful of sensitive UI surfaces
(certs, credentials, settings) so `event.senderFrame` can gate which origin may call which IPC channel,
closing a gap the `services.invoke` named-handler migration (`CROSS-TENANT-DB-ACCESS-FINDINGS.md`
Finding 3, fully landed) structurally cannot close: that migration eliminated off-menu invocation, but
cannot restrict a legitimate method to only be callable from the UI section that legitimately uses it,
because the entire main app UI renders in one `BrowserWindow`/one JS realm today. A grilling session
against that proposal (recorded in full below, not summarized away) revised it substantially before any
code was written — the revisions are load-bearing, not cosmetic, so they're kept as first-class content
rather than folded silently into a "final" plan.

---

## How this plan changed under scrutiny, and why

1. **Frame isolation alone was the wrong first move.** It only limits blast radius *after* an XSS lands
   somewhere; it does nothing to reduce the odds of one landing at all. Direct source read confirmed the
   app currently ships a CSP that is permissive to the point of being a no-op (`root.tsx:206-256`:
   wildcard `default-src`, `'unsafe-eval'`, `'unsafe-inline'`, wide-open `img-src`/`frame-src`/
   `media-src`) and has never used Trusted Types anywhere in application code. Hardening that first is
   cheaper, broader, and de-risks the frame-isolation spike by giving it a stronger baseline to spike
   against. **Decision: CSP/Trusted-Types work (Track 1, below) lands first, sequentially — Track 2 does
   not commit past its own Phase 0 spike until Track 1's Phase 2 (enforced CSP) has shipped.**
2. **The original scope boundaries needed correcting with facts, not assumptions.** `environment` was
   rightly excluded for ordinary reads (154 call sites across `render.ts`, `network.ts`, sidebar/workspace
   loaders — genuinely too pervasive to isolate without isolating most of the app). But a narrower,
   genuinely isolable sub-surface exists inside it that the original blanket exclusion missed: SECRET-typed
   value encrypt/decrypt (`ui/components/editors/environment-key-value-editor/key-value-editor.tsx:280-306,447-454`)
   plus the vault-key flow (`auth.create-vault-key.tsx`, `input-vault-key-modal.tsx`,
   `vault.encryptSecretValue`/`decryptSecretValue` IPC in `main/ipc/main.ts:1282-1286`) — structurally the
   same shape as certs/credentials, not a pervasive read path.
   Separately, an instinct raised mid-session — "isolate git/GitHub-related things because that data is
   untrusted" — turned out to be a category error once checked against source: git-synced/imported/
   plugin-contributed content writes into the same shared NeDB models and renders through the same generic
   sidebar components (`ui/components/sidebar/request-node.tsx:127-128`,
   `project-navigation-sidebar.tsx:1259`) used for everything else. Frame isolation can't gate *what
   renders*, only *who may call a channel* — that concern belongs to Track 1 (CSP/Trusted-Types), not
   Track 2. The insight that resolved this: once sensitive channels are frame-gated, an XSS's *origin*
   stops mattering — a git-sync-sourced payload landing in the main frame is blocked from reaching gated
   channels exactly like any other main-frame compromise, with zero git-specific work required. No
   dedicated git/GitHub frame is included in this plan for that reason.
3. **This isn't a fix for 3 items — it's a standing architectural pattern.** The driving idea: future
   features that integrate significant new capability/data should get least-privilege IPC segmentation
   from day one, not bolted on later. Track 2 therefore delivers a *reusable* scaffold, modeled on the
   plugin sandbox's own proven capability-manifest shape (`common/plugins/permissions.ts`'s
   `parsePluginPermissions` — confirmed by direct read to be default-deny, gracefully-degrading on
   malformed input, explicit-allowlist; `templating/sandbox/host-bridge.ts`'s
   `BRIDGE_PATH_CAPABILITIES`/`filterByCapabilities`), applied to four concrete targets — certs,
   settings+credentials+vault-secret, auth, and MCP as a deliberate stress test of a richer, more
   interactive surface than a simple CRUD modal — with two more candidates (mock servers, Konnect publish)
   documented for future waves rather than open-endedly expanded now.

Both tracks are phased so every phase/sub-phase ends in one or more small, reviewable commits, per this
branch's established convention (e.g. `afc1ec1f6`, `beea83400`) — never one giant commit per phase.

---

## Track 1 — CSP / Trusted Types hardening (executes first)

**Goal:** reduce the odds of an XSS landing at all, independent of and prior to Track 2.

### Phase 0 — Discovery (no product code)
- Audit every `eval`/`new Function`/`.innerHTML`/`dangerouslySetInnerHTML` reachable from the main
  renderer bundle only (exclude sandbox-vendored and hidden/plugin-window-only code, which run outside
  this CSP — those windows deliberately run `contextIsolation: false, nodeIntegration: true` already, so
  CSP hardening there wouldn't meaningfully change their posture). Known candidates already found:
  `script-executor.ts:32` (deliberate `eval`), one `dangerouslySetInnerHTML`, `.innerHTML` in
  `html-element-wrapper.tsx` + 3 CodeMirror extension files.
- Add scoped ESLint `no-eval`/`no-implied-eval`/`no-new-func` for `src/ui/**`, `src/root.tsx`,
  renderer-facing `src/main/**` — regression guard, not a full discovery tool on its own.
- Confirm Vite HMR origin/port requirements (`vite.config.ts`) so dev-only CSP additions can be split
  cleanly from production.
- Commit: `chore(csp): audit eval/innerHTML usage and vite HMR origins`.

### Phase 1 — Report-Only rollout
- The existing CSP lives as a `<meta>` tag in `root.tsx:206-256` — this is a **hardening**, not a
  greenfield add. Introduce a parallel `Content-Security-Policy-Report-Only` header via
  `session.defaultSession.webRequest.onHeadersReceived`, scoped to the `insomnia-app.local` origin,
  extending `main/api.protocol.ts`'s existing registration (confirmed by direct read: the `https` handler
  already special-cases exactly one hostname at line 137 and cleanly falls through to `net.fetch`
  otherwise — this extension is small and safe). Route violation reports to a new local-only collector
  scheme.
- Candidate tightened directives: drop `'unsafe-inline'` from `style-src` (pending Phase 0 confirmation
  Tailwind/React here don't rely on inline `style=`), keep `'unsafe-eval'` pending `script-executor.ts`'s
  execution-context confirmation, replace wildcard `img-src`/`media-src`/`frame-src`/`connect-src` with an
  explicit set that still allows arbitrary user-configured HTTP(S) endpoints (this is the app's core
  function — do not narrow host lists, only remove wildcards/unsafe keywords that aren't load-bearing).
- Commit: `feat(csp): add Content-Security-Policy-Report-Only header for insomnia-app.local`.
- Verify by clicking through response viewers, git sync pull, HAR/OpenAPI/Postman/curl import, and
  plugin-contributed UI in dev — zero enforcement yet, so zero regressions expected; triage any reports.

### Phase 2 — Enforce
- Promote the header to enforcing and reconcile the `root.tsx` meta tag to the same policy (single source
  of truth module if bundler boundaries allow; otherwise two copies pinned identical by a test, matching
  the existing `window-security.test.ts` convention).
- Commits: `feat(csp): enforce tightened policy in production CSP meta tag`,
  `test(csp): pin CSP directives against regression`.
- Verify: repeat the manual click-through expecting enforcement now; add one deliberate-payload smoke
  test (an imported/synced item with an inline `<script>` in its name, asserting it renders inert) — this
  proves the security property, not just header presence.

### Phase 3 — Trusted Types
- Add `require-trusted-types-for 'script'` to the Report-Only header first; define one named policy
  (`src/ui/trusted-types-policy.ts`) and route the ~5 known sink sites through it explicitly.
- Commits: `feat(csp): add Report-Only Trusted Types policy for HTML sink sites`, then
  `feat(csp): enforce Trusted Types for script sinks` after triage.
- **Known risk to spike, not assume away:** Monaco/CodeMirror's own vendored code may write `innerHTML`
  internally in ways not interceptable without patching the dependency. If so, ship Report-Only
  indefinitely for those specific sinks and record it as a known, accepted gap rather than silently
  weakening the policy.

**Sequencing with Track 2:** Track 2's Phase 0 spike may run in parallel with late Track 1 work; Track 2
should not commit past its own spike until Track 1's Phase 2 (enforced CSP) has landed.

---

## Track 2 — Reusable isolated-feature-frame architecture (executes after Track 1 ships)

**Architecture:** same-window `<iframe>`, distinct origin per frame (Option A) — **each of the four pilot
targets gets its own origin** (`insomnia-frame-certs.local`, `-settings.local`, `-auth.local`,
`-mcp.local`), not one shared "sensitive" origin. Sharing one origin across certs/settings/auth/MCP would
collapse exactly the boundary this plan exists to create: an XSS inside one would read as "the isolated
frame" for the others' channels too, and they'd share a JS heap across unrelated sensitive surfaces.
Option B (`WebContentsView`, genuinely separate `webContents`/process) and Option C (separate
`BrowserWindow`) remain the fallback/rejected alternatives respectively, unchanged from the original
proposal's reasoning — Option C is a poor UX fit for "a section of the same app." The `event.senderFrame`
origin-match check is identical whether the underlying frame is a same-window iframe or a future
`WebContentsView` upgrade, so nothing here is wasted if Phase 0 finds Option A's process isolation
insufficient for a given target.

### Phase 0 — Spike (go/no-go checkpoint before any further commitment)
- Confirm `event.senderFrame` origin attribution for a distinct-origin same-window iframe under this
  repo's pinned Electron version, and confirm with `webContents.getOSProcessId()` whether Chromium
  actually process-isolates it here (**OQ-1** — if not, recommend `WebContentsView` for MCP specifically,
  the highest-value/most-interactive target, while certs/settings/auth stay on the cheaper iframe).
- Resolve the vault-channel design question (**OQ-2**): can `vault.encryptSecretValue`/`decryptSecretValue`
  be gated by frame origin without moving the key-value editor's UI into the auth frame, i.e. is the
  encrypt/decrypt call a stateless keyed operation with no ambient secret material reachable from the
  calling frame? If the KV editor's own frame turns out to be a plausible attacker itself, the plan flips
  to moving that UI into the auth frame.
- Sketch (design doc, not code) the manifest schema and each pilot's state-bridging contract: certs and
  MCP need workspace/org/project ids (already URL-param-derived via `useParams()` per direct source read
  of `workspace-certificates-modal.tsx:20,35,245,323,420` — bridge via the iframe `src`, no `postMessage`
  needed); settings/auth re-derive session/settings via their own `initServices()` call, mirroring
  `entry.plugin-window.ts`'s existing precedent (a swappable `services` singleton,
  `insomnia-data/src/services/index.ts:10`), rather than threading state through messages. No React
  Context (theme, workspace) needs bridging beyond this — confirmed no `ThemeContext`/`useTheme` exists
  anywhere in the codebase.
- No commits expected beyond optional scaffolding preservation. **Report findings; get explicit go/no-go
  before Phase 1.**

### Phase 1 — Scaffold (reusable pattern; no UI moved yet)
New shared files, modeled directly on the plugin sandbox's proven shape:
- `isolated-frames/manifest-types.ts` — `IsolatedFrameManifest { id, origin, allowedChannels, entryModule, title }`,
  parsed as defensively as `parsePluginPermissions` (malformed → deny, never throws).
- `isolated-frames/registry.ts` — single source of truth, analogous to `BRIDGE_PATH_CAPABILITIES`; a
  completeness test asserts every gated channel has exactly one owning frame.
- `main/isolated-frame-gate.ts` — `requireFrameOrigin(channel, event)`, modeled on `filterByCapabilities`:
  looks up the owning frame, compares `event.senderFrame.url` origin, rejects before the handler runs.
- `main/isolated-frame-protocol.ts` — generalizes `api.protocol.ts`'s one-off `insomnia-app.local` branch
  (line 137) into a hostname→dist-dir lookup driven by the registry.
- `isolated-frames/create-isolated-frame-entry.ts` + `ui/components/isolated-frame-host.tsx` — generic
  renderer-side entry helper (mirrors `entry.plugin-window.ts`) and the parent-side `<iframe>` wrapper
  pilots embed.
- `esbuild.entrypoints.ts` wiring per new entry/preload pair (mechanical, matches existing
  hidden-window/plugin-window blocks).

Commits: manifest+registry → gate helper → protocol hostname routing → entry/host component → esbuild
wiring. Each carries its own unit test (parsing edge cases, gate accept/reject, registry completeness).

### Phase 2 — Pilot: Certs
- `entry.certs-frame.tsx`/`-preload.ts` exposing only `caCertificate.*`/`clientCertificate.*`. Move
  `workspace-certificates-modal.tsx`'s body in; it already reads `organizationId`/`projectId`/
  `workspaceId` from `useParams()`, so the iframe `src` carries the same path segments — no bridging
  channel needed.
- Commits: stand up the frame (UI move, no gating) → gate the two handler groups in
  `main/ipc/services-invoke-migrated-handlers.ts` via `requireFrameOrigin`, with accept/reject regression
  tests (legit origin succeeds; no-`senderFrame` and wrong-origin calls rejected).

### Phase 3 — Pilots: Settings (+credentials+vault-secret), Auth
- **3a Settings:** `entry.settings-frame.tsx` covers the whole `settings-modal.tsx` tab tree — confirmed
  by direct read that `settings-modal.tsx:43-229` is one single component tree with pure client-side tabs
  (React Aria `Tabs`, local `useState`, not URL-driven), so general, credentials (git+cloud), vault-key
  panel, plugins, etc. are already one component tree today — this costs nothing extra to include, whereas
  splitting credentials into their *own* separate frame from the rest of Settings would cost a real UX
  redesign of that fused tab architecture. Exposes `settings.*`, `cloudCredential.*`, `gitCredentials.*`.
  Two commits (stand-up, then gate+test), same shape as Phase 2.
- **3b Auth/session:** `entry.auth-frame.tsx` covers the `auth.tsx` route tree (genuinely separate from
  Settings, not modal-nested), exposing `userSession.*` plus vault-key creation/reset channels. Same
  two-commit shape.
- **3c Vault secret-mutation channel:** per Phase 0's OQ-2 answer, planned default is gating
  `vault.encryptSecretValue`/`decryptSecretValue` as their own registry entry owned by the auth frame
  *without* moving the KV editor's UI — this is the one place Phase 3 needs a genuine cross-frame RPC hop
  (KV editor's frame → the auth frame → IPC) rather than a same-frame move. Its own commit + gating commit
  with accept/reject tests.

### Phase 4 — MCP migration (stress test)
- `entry.mcp-frame.tsx` covers the `mcp.tsx` route's component tree (mcp-pane, mcp-request-pane,
  mcp-url-bar, `mcp-certificates-modal.tsx`, mcp-actions-dropdown, elicitation/sampling forms). Manifest
  lists the ~15-18 `mcp.*` channels (`window.main.mcp.primitive.{listTools,listPrompts,listResources,
  callTool,readResource,getPrompt}`, `mcp.client.{responseElicitationRequest,responseSamplingRequest,
  hasRequestResponded}`, `mcp.{close,authConfirmation}`, `mcp.notification.rootListChange`,
  `mcp.readyState.getCurrent`, `mcp.event.findMany`) plus `services.mcpRequest.getByParentId`,
  `services.project/workspace.getById`. `window.main.getOAuth2Token` and `window.main.writeFile` are
  cross-cutting (used by non-MCP callers too) — their gating must be **additive** (allow from MCP frame
  origin OR existing callers), never a narrowing that breaks other call sites; call this out explicitly
  in review.
- Expect a bidirectional `postMessage` contract (host UI shows elicitation-modal chrome; the frame owns
  MCP client/streaming state) — this is the scaffold's real stress test, deliberately chosen for that
  (chosen over mock-servers/Konnect as the second migration precisely because those are narrow enough
  that almost any approach would work on them).
- Three commits: stand up frame → gate `mcp.*`/`mcpRequest` handlers (with tests) → make
  `getOAuth2Token`/`writeFile` gating additive.

### Phase 5 — Smoke tests
One Playwright spec per migrated domain (confirm actual existing test directory before adding), each
proving (a) normal use is unchanged and (b) a script executed in the main frame's context attempting to
call an in-scope channel directly is rejected — the second assertion is what actually proves this track
delivered something the named-handler migration didn't. One commit per spec.

### Recommendations (not executed phases)
- **Standing convention:** new features introducing a genuinely new credential/secret surface or new
  externally-reachable capability should default to landing as an isolated frame from day one, using the
  Phase 1 scaffold — recommended for team/process adoption, not mandated by this plan.
- **Future candidate — mock servers**: `...workspace.$workspaceId.mock-server*.tsx` + `mock-route-modal.tsx`;
  narrow `mockServer.*`/`mockRoute.*` surface; sensitivity is spinning up a real externally-reachable HTTP
  server, not credentials.
- **Future candidate — Konnect publish**: `konnect-settings-modal.tsx` (standalone, not settings-nested);
  handles the Konnect PAT via `secretStorage.{getSecret,setSecret,deleteSecret}('konnectPat')` plus
  outbound validation calls.

### Open design questions carried into Phase 0 (flagged, not guessed)
- **OQ-1:** does same-`BrowserWindow`, different-origin iframe get real process isolation in this
  Electron build, or only the `senderFrame`-check property? Decides Option A vs. B for MCP.
- **OQ-2:** does channel-only gating (no UI move) hold for the vault encrypt/decrypt calls, or is the KV
  editor's own frame itself inside the threat model?
- **OQ-3:** every `postMessage` listener introduced by Phase 1's host component and Phase 3c/4's
  bidirectional plumbing must validate `event.origin` explicitly — a required review checklist item per
  pilot commit, not a one-time scaffold guarantee.

---

## Standing rules for whoever executes this plan

- Phase 0 (both tracks) is a spike: it may produce no committed code at all, and that is a valid, complete
  outcome for that phase — do not treat "the spike concluded this isn't worth it" as failure to execute.
- Every phase's commits (once past a Phase 0 spike) follow this branch's existing convention: small,
  reviewable, one commit per batch — never one giant commit for a whole phase.
- Apply this branch's comment-cleanup convention to every file touched: no finding/item/ticket numbers, no
  "victim"/"attacker" language, in code comments, test names, or fixture names — comments describe only
  the underlying behavior being enforced, roughly one sentence by default, longer only for a genuinely
  non-obvious invariant or workaround.
- Never commit this file, `CROSS-TENANT-DB-ACCESS-FINDINGS.md`, `SANDBOX-SECURITY-FINDINGS.md`, or any
  other plan/handoff-style scratch doc in this directory — working-tree-only.
- Never push, force-push, or touch any remote branch/PR for this work without the user's explicit
  confirmation first.
- Get explicit user confirmation before starting Track 2 Phase 1 (committing to the architecture change)
  — Phase 0's spike findings should be presented and discussed first.

## Cross-references
- The `services.invoke` named-handler migration — this plan builds on top of it; see "Origin" above.
- `CROSS-TENANT-DB-ACCESS-FINDINGS.md` Finding 3 — the original finding that motivated the migration; this
  plan would be a new finding in that same tracker once it moves past planning, not an amendment to
  Finding 3 itself.
- `templating/db-trust.ts`'s `recordBelongsToCallerWorkspace` + `templating/sandbox/in-sandbox-bootstrap.ts`
  — the existing precedent in this codebase for host-verified caller attribution across a real isolation
  boundary, which Track 2's Phase 2-4 gating checks are modeled on.
- `common/plugins/permissions.ts` + `templating/sandbox/host-bridge.ts` — the capability-manifest shape
  Track 2's Phase 1 scaffold mirrors directly.

## Critical files
- `packages/insomnia/src/root.tsx` (existing CSP meta tag)
- `packages/insomnia/src/main/api.protocol.ts` (protocol/origin registration, extension point for both
  the CSP header and the per-frame hostname routing)
- `packages/insomnia/src/main/window-security.ts` (CI-pinned security-constant pattern to mirror)
- `packages/insomnia/src/script-executor.ts` (deliberate `eval` usage to audit)
- `packages/insomnia/src/common/plugins/permissions.ts` and
  `packages/insomnia/src/templating/sandbox/host-bridge.ts` (the capability-manifest shape Track 2 mirrors)
- `packages/insomnia/src/entry.plugin-window.ts` / `entry.plugin-window-preload.ts` /
  `main/plugin-window.ts` (existing separate-frame/sender-check precedent)
- `packages/insomnia/src/ui/components/modals/workspace-certificates-modal.tsx`,
  `settings-modal.tsx`, and the MCP route
  `routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.tsx` (pilot targets)
- `packages/insomnia/src/main/ipc/services-invoke-migrated-handlers.ts` (where Phase 2-4's gating calls land)

## Verification
- Track 1: `npm run lint && npm run type-check && npm test -w packages/insomnia` after each phase; manual
  click-through of response viewers/git-sync/import/plugin flows in dev after Phases 1-2; the
  deliberate-payload smoke test in Phase 2 as the actual security-property proof.
- Track 2: unit tests per scaffold commit (manifest parsing, gate accept/reject, registry completeness);
  accept/reject regression tests per pilot gating commit; Playwright smoke tests per Phase 5, run via
  `npm run test:smoke:dev -- <spec-substring>`; full `npm test -w packages/insomnia` + `npm run lint` +
  `npm run type-check` before considering any phase done.
