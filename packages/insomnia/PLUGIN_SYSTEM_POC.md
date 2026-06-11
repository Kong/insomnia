# Plugin System POC Outline

## Current PR review scope

This branch contains some stacked prerequisite changes alongside the Phase 1a plugin bridge work.

For review, focus primarily on:

- `src/main/plugin-window.ts`
- `src/entry.plugin-window.ts`
- `src/entry.plugin-window-preload.ts`
- `src/entry.preload.ts`
- `src/plugins/*`
- `packages/insomnia-smoke-test/tests/smoke/plugin-bridge.test.ts`

Other changes in the branch are supporting or preparatory work and can be reviewed more lightly in the context of Phase 1a.

## Goal

Design a new plugin system for the Electron app that supports:

- `rendererFunctions` for UI-safe extension points in the renderer
- `mainFunctions` for privileged capabilities that must run in the main process
- a sandbox model that keeps third-party plugins off direct Electron and Node APIs unless explicitly allowed

The migration is split into phases to avoid breaking existing plugin behaviour:

- **Phase 1a:** improve the legacy behaviour test baseline and route all plugin execution through an IPC bridge to a hidden BrowserWindow with `nodeIntegration: true`. No plugin code is moved yet — the renderer still loads plugins, but all invocations cross the bridge. _(current PR)_
- **Phase 1b:** move all plugin code to run exclusively inside the hidden BrowserWindow. Plugin context modules (`plugins/context/`, `plugins/index.ts`) are removed from the main renderer bundle entirely. The renderer becomes a pure client of the bridge.
- **Phase 1c:** disable `nodeIntegration` in the main BrowserWindow. Tackle the remaining renderer-side Node.js dependencies together: direct Electron imports, `fs` operations, `process.env` access, dynamic `require('electron')`, and `node:crypto`/`node:os` usage.
- **Phase 2:** replace the hidden window's `nodeIntegration: true` runtime with a stricter sandbox (`contextIsolation: true`, capability-based permissions). Plugin authors migrate to the new API surface.

## Why now

The app already has:

- plugin discovery and loading in `src/plugins/index.ts`
- preload bridge patterns in `src/entry.preload.ts`
- IPC handler registration in `src/entry.main.ts` and `src/main/ipc/*`
- an ongoing renderer hardening effort in `NODE_INTEGRATION_MIGRATION_PR_PLAN.md`

This makes a capability-based plugin redesign a natural fit for the direction of the architecture, but not for the current runtime shape. Today the plugin system is still heavily renderer-coupled.

## Current state

Today plugins primarily contribute exports like:

- `templateTags`
- `requestHooks`
- `responseHooks`
- `requestActions`
- `requestGroupActions`
- `workspaceActions`
- `documentActions`

There is also an internal-only `unsafePluginMainActions` path for bundled plugins. That proves the app already needs main-process plugin execution, but the current shape is too narrow and too trusted for a general public plugin API.

Just as importantly, current plugin consumption is still renderer-heavy:

- parts of plugin discovery/loading can run in renderer contexts
- themes are queried directly from UI hooks
- action plugins are fetched and executed directly from UI components
- plugin context helpers currently expose renderer-bound APIs like dialogs, clipboard, and prompt flows

This plan is therefore a redesign from the current state, not a small cleanup of an already-main-owned system.

## POC outcome

Define a plugin API and execution model that:

1. keeps plugin lifecycle out of the app UI renderer
2. routes privileged work through preload and IPC
3. allows fine-grained permission checks for `mainFunctions`
4. remains compatible with future `contextIsolation: true`

## Ownership model

### Target state

Plugin discovery, manifest validation, trust checks, and function registration should be owned by the main process.

The app UI renderer should not load plugin packages directly. It should only:

- query which plugin capabilities are available
- invoke approved functions through a narrow bridge
- receive serialized results and metadata

If `rendererFunctions` exist, they should run in a dedicated sandboxed plugin host, not inside the normal app UI runtime.

### Current gap from target state

This is not how the app works today. The current system still allows plugin enumeration and execution in UI code.

#### Phase 1 move

Phase 1 moves the system in three steps.

**Phase 1a** (current PR): adds the bridge and routes execution through it, but plugin code still lives in the renderer bundle:

```text
renderer loads plugins -> renderer calls bridge -> hidden window re-executes via its own copy of plugin code
```

**Phase 1b**: removes plugin code from the renderer bundle entirely so only the hidden window owns it:

```text
hidden plugin window loads plugins -> renderer requests execution via IPC bridge -> hidden window executes and returns result
```

**Phase 1c**: disables `nodeIntegration` in the main window, eliminating residual Node.js usage in the renderer (direct `fs`, `require('electron')`, `process.env`, `node:crypto`, etc.).

Plugin trust level is unchanged across all of Phase 1. The hidden window retains `nodeIntegration: true` throughout.

#### Phase 2 move

Phase 2 then moves to the full target state:

```text
main discovers and registers plugins -> hidden sandboxed window executes via context API -> renderer requests through bridge only
```

## Proposed plugin shape

```ts
export interface InsomniaPlugin {
  name: string;
  version: string;
  rendererFunctions?: RendererFunctionDefinition[];
  mainFunctions?: MainFunctionDefinition[];
}

export interface RendererFunctionDefinition<Args = unknown, Result = unknown> {
  name: string;
  description?: string;
  handler: (context: RendererPluginContext, args: Args) => Result | Promise<Result>;
}

export interface MainFunctionDefinition<Args = unknown, Result = unknown> {
  name: string;
  description?: string;
  permissions?: PluginPermission[];
  handler: (context: MainPluginContext, args: Args) => Result | Promise<Result>;
}
```

## Execution model

### `rendererFunctions`

- Registered by the main process and executed in a dedicated sandboxed plugin host
- Intended for UI workflows, request shaping, data transforms, and app-level orchestration
- Must not access Electron, Node builtins, or raw IPC directly
- Can call approved bridge APIs exposed through a plugin context
- Must not rely on direct React component state, direct database model mutation, or window-scoped UI helpers

### `mainFunctions`

- Registered in the main process as named plugin capabilities
- Invoked from the renderer through a single preload bridge such as:

```ts
window.plugins.invokeMain(pluginName, functionName, args);
```

- Must pass permission checks before execution
- Return serialized results only

## Recommended routing

### Control plane

```text
plugin package on disk -> main process discovery -> manifest validation -> function registry
```

### Renderer function path

```text
UI -> preload bridge -> IPC -> sandboxed plugin host -> rendererFunction
```

### Main function path

```text
UI -> preload bridge -> IPC -> plugin main registry -> mainFunction
```

This keeps plugin loading and trust decisions out of the UI while still matching the existing preload and IPC pattern in `src/entry.preload.ts`.

## inso CLI and `process.type` guards

Many modules in `src/plugins/` contain branches guarded by `process.type === 'renderer'`. These are **not** general renderer-detection guards — they exist because the inso CLI reuses the same code paths as the Electron renderer but loads plugin implementations directly rather than going through the IPC bridge.

In Electron the check is true and the code reaches IPC-bound paths. In inso (a Node.js process with no Electron renderer) the check is false and the code falls back to direct module imports.

This has two consequences for Phase 1b:

1. **Do not remove these guards.** Stripping them to simplify the hidden window code will break inso silently. The guards must be preserved in any shared module that inso also imports.
2. **The hidden window is itself a renderer (`process.type === 'renderer'` is true).** Any code running there that hits these branches will follow the IPC path — which is correct for the app, but means the guard alone is not a reliable way to distinguish "app renderer" from "hidden plugin window." If Phase 1b needs to distinguish between the two contexts, use a dedicated flag (e.g. a custom `window.__PLUGIN_WINDOW__` set by the hidden window's preload) rather than relying on `process.type`.

## Host decision

The plugin host for `rendererFunctions` is a **dedicated hidden BrowserWindow**.

### Phase 1 configuration

```
nodeIntegration: true
contextIsolation: false
show: false
webPreferences: { backgroundThrottling: false }
```

This is deliberately permissive. It matches the trust level plugins already have today (full renderer access), but moves them out of the app UI window. Existing plugins run unchanged.

### Why hidden BrowserWindow over alternatives for Phase 1

| Option                                       | Phase 1 suitability | Notes                                                                    |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| Hidden BrowserWindow (nodeIntegration: true) | Best                | Full Node/Electron compat, easy IPC, matches current plugin expectations |
| Worker                                       | Poor                | No Node builtins, breaks most existing plugins                           |
| Utility process                              | Poor                | No DOM, breaks renderer-oriented plugin APIs                             |
| Second full window                           | Overkill            | Hidden window achieves the same isolation with less overhead             |

### Phase 2 configuration

Once plugins are fully isolated in the hidden window, Phase 2 tightens the window:

```
nodeIntegration: false
contextIsolation: true
sandbox: true
```

Plugin capabilities are then re-exposed through a controlled preload bridge only.

### Impact on design

- Module loading: Node `require()` in Phase 1; bundled/ESM modules via preload in Phase 2
- Serialization: IPC boundary between hidden window and main process enforces JSON serialization from day one
- UI helpers: dialog/prompt calls in Phase 1 route through IPC to the main renderer; in Phase 2 they become explicit bridge APIs
- Startup cost: hidden window is created eagerly at app startup and kept alive, not spawned per call

## Sandbox model

> Phase 1 does not enforce this model. The hidden window runs with `nodeIntegration: true` and plugins retain full trust. The sandbox model below is the Phase 2 target.

### Default sandbox

Third-party plugins should run with:

- no direct `electron` import
- no direct Node builtin imports
- no access to `ipcRenderer`
- no access to unrestricted `window.main`
- no direct loading by the app UI renderer

Instead, they receive a constrained context object:

```ts
type RendererPluginContext = {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  requests: {
    getById(id: string): Promise<Request | null>;
  };
  plugins: {
    invokeMain(pluginName: string, functionName: string, args?: unknown): Promise<unknown>;
  };
};
```

This context should be intentionally smaller than the current plugin context surface. In particular, renderer-hosted plugins should not assume direct access to:

- prompt and modal helpers
- clipboard helpers
- direct request/workspace model mutation
- unrestricted store or network helpers without bridge review

### Main sandbox

`mainFunctions` should not mean "full trust". They should run behind:

- plugin registration allowlist
- per-function permission metadata
- argument validation
- structured result serialization
- explicit logging for invocation and failure

### Permission examples

```ts
type PluginPermission =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network.fetch'
  | 'shell.openExternal'
  | 'secrets.read'
  | 'secrets.write';
```

The first POC should likely keep this list small.

## Mutation and command protocol required for legacy action migration

The plan assumes medium-risk legacy action features can migrate onto `rendererFunctions`, but that is only realistic if the new system defines how plugins request side effects.

Today many action plugins effectively rely on direct execution with live model objects and rich helper context. A separate host cannot preserve that model safely.

Before migrating `requestActions`, `requestGroupActions`, `workspaceActions`, or even `documentActions`, the new system needs an explicit protocol for things like:

- request mutations
- workspace mutations
- user-visible commands
- persistence requests
- error and confirmation flows

The likely shape is a DTO / command / patch model, for example:

```ts
type PluginCommand =
  | { type: 'update-request'; requestId: string; patch: unknown }
  | { type: 'update-workspace'; workspaceId: string; patch: unknown }
  | { type: 'show-notification'; level: 'info' | 'warning' | 'error'; message: string };
```

Pass 1 does not need to finalize the full protocol, but it should prove at least one realistic command flow end-to-end.

### Concrete migration example: `documentActions`

One low-risk example for the eventual Phase 2 command model is `documentActions`.

The flow would look like:

1. the UI triggers `window.plugins.invokeRenderer(pluginName, 'documentAction.rename', { documentId })`
2. the hidden plugin host executes the plugin function with a constrained context
3. the plugin returns a structured command such as `{ type: 'update-document', documentId, patch: { name: 'New Name' } }`
4. the host applies the command through the approved bridge and returns success metadata to the caller

This is intentionally narrow, but it demonstrates that action-style plugins can move off direct model mutation without requiring Phase 1 to solve the full mutation protocol.

## How this works with Electron sandboxing

If the app continues toward `contextIsolation: true`, the model becomes:

1. preload exposes a minimal `window.plugins` bridge
2. main owns plugin loading and registration
3. `rendererFunctions` run in a separate isolated plugin host
4. privileged work always crosses the preload boundary
5. main-process plugin handlers remain the only place with privileged Electron access
6. the app UI renderer never imports plugin packages directly

That means the plugin system should be designed so the renderer is a client of the plugin system, not the owner of plugin loading, even if the current app still has `nodeIntegration: true` in places.

## Suggested preload API

```ts
type PluginBridgeAPI = {
  invokeMain: (pluginName: string, functionName: string, args?: unknown) => Promise<unknown>;
  invokeRenderer: (pluginName: string, functionName: string, args?: unknown) => Promise<unknown>;
  listFunctions: () => Promise<
    {
      pluginName: string;
      mainFunctions: string[];
      rendererFunctions: string[];
    }[]
  >;
};
```

This keeps the public renderer surface narrow and auditable.

## Suggested main-process pieces

- `src/plugins/registry.ts`
  - normalize plugin exports
  - register `rendererFunctions` and `mainFunctions`
- `src/plugins/plugin-host.ts`
  - manage the sandboxed host used for `rendererFunctions`
- `src/main/ipc/plugins.ts`
  - IPC entry point for plugin invocation
- `src/entry.preload.ts`
  - expose `window.plugins`
- `src/global.d.ts`
  - type the new preload bridge

## Validation and safety rules

- Function names must be unique per plugin
- Main invocation payloads must be JSON-serializable
- Renderer invocation payloads must be JSON-serializable
- Errors should be normalized before crossing IPC
- Plugin permissions should be visible in settings
- Disabled plugins should not register either renderer or main functions
- The UI renderer must not import or execute plugin packages directly
- The registry must detect mixed legacy/new export shapes and apply explicit coexistence rules

## Design decisions

1. **Should public plugins ever get `mainFunctions`, or should that be opt-in behind a trust prompt?**
   Deferred to Phase 2. Phase 1 does not introduce `mainFunctions` for public plugins.

2. **Should `mainFunctions` run in the main process directly, or in a dedicated utility process?**
   Main process for now. The utility process option remains open for a later pass if the trust surface warrants it.

3. **Should plugin permissions be granted per plugin, per function, or per capability group?**
   Deferred to Phase 2 when the permission model is introduced.

4. **Should bundled first-party plugins keep a separate trusted path?**
   No. Bundled plugins are already co-located and implicitly trusted by virtue of being shipped with the app. No separate path is needed.

5. **What is the concrete host for `rendererFunctions`?**
   A dedicated hidden BrowserWindow. Phase 1 uses `nodeIntegration: true` to preserve existing behaviour. Phase 2 revisits the configuration to meet sandboxing requirements (see [Host decision](#host-decision)).

6. **What is the minimum viable mutation / command protocol for migrating legacy actions?**
   Deferred to Phase 2. In Phase 1, plugins run with `nodeIntegration: true` and can still call back to main via IPC using existing mechanisms, so direct model mutation is preserved. Phase 2 introduces the sandbox that removes direct model access, and at that point a command/patch protocol becomes necessary — plugins will return structured commands (e.g. `{ type: 'update-request', requestId, patch }`) rather than mutating models in place.

## POC phases

### Phase 1a: bridge and baseline (current PR)

**Goal:** establish a legacy behaviour test baseline and route all plugin invocations through an IPC bridge to a hidden BrowserWindow. Plugin code still exists in the renderer bundle — this phase proves the bridge, not the isolation.

#### What changes

- Legacy behaviour baseline tests written for all plugin export types (happy path + error path)
- Hidden BrowserWindow created and managed from main (`nodeIntegration: true`, `show: false`)
- IPC bridge added so all renderer-side plugin invocations cross to the hidden window before executing
- Renderer-side plugin calls redirected through the bridge; the hidden window runs the actual plugin code

#### What does not change

- Plugin code is still bundled with the renderer (duplication, not isolation)
- Plugin export shape (`templateTags`, `requestHooks`, `responseHooks`, etc.) is unchanged
- Plugin authors do not need to update anything
- No permission model enforced

#### Deliverables

1. Legacy behaviour baseline tests green in CI
2. Hidden plugin window created and managed from main
3. IPC bridge routing all renderer plugin invocations to the hidden window
4. Zero behavioural regressions against baseline
5. Bridge observability: per-invocation structured logs (`[plugin-bridge] invoke method=… outcome=… duration_ms=…`), startup timing (`window_ready startup_ms=…`), crash events (`window_crash reason=…`), and a snapshot accessor (`window.main.plugins.getBridgeMetrics()` → `plugins.getBridgeMetrics` IPC handler) exposing per-method `{ok, error, timeout, avgDurationMs, maxDurationMs}` and window counters

#### What Phase 1a actually proves vs defers

Phase 1a is a transport and hosting proof. Reviewers should read the deliverables narrowly:

**Proven by Phase 1a**

- The IPC bridge can carry every existing plugin capability shape (template tags, request/response hooks, request/group/workspace/document actions, bundled main actions, theme listing) end-to-end with serializable arguments and results
- The hidden BrowserWindow lifecycle (creation deferred until main window loads, ready signalling, reload, teardown) is viable on darwin/win32/linux
- Failure shapes from plugin code (sync throw, async reject with `Error`, async reject with non-`Error`) surface as rejections on the renderer side rather than as hangs or silent successes
- Concurrent invocations are routed back to the correct caller (per-request `id` in `pluginRequests`)

**Not proven, still risky after Phase 1a**

- _Action mutation semantics._ Request/workspace/document actions still mutate models through the renderer-side context object. The bridge serializes inputs and outputs, but no mutation contract is enforced. Side-effect ordering between an action's UI calls (`alert`/`prompt`) and its model writes is unchanged from the legacy runtime — and untested under the new transport.
- _Template tags._ Listing and `runTemplateTagAction` are bridged, but Nunjucks rendering still executes in the existing template worker. Isolation of tag execution is unchanged in 1a.
- _inso CLI compatibility._ inso does not use the bridge. Any divergence between app-side and CLI-side plugin behaviour is unaddressed here and only surfaces in Phase 1b when `process.type` guards are touched.
- _True isolation._ The hidden window runs with `nodeIntegration: true` and `contextIsolation: false`. Plugins are still trusted with full Node access. Sandbox claims belong to Phase 1c (renderer hardening) and Phase 2 (plugin window hardening), not 1a.
- _Final plugin API._ Plugin authors see no API change. The `rendererFunctions`/`mainFunctions`/permission shape from this document is design-only until Phase 2.
- _Crash recovery._ `render-process-gone` increments a counter and rejects in-flight requests, but there is no auto-restart loop. A crashed plugin window will be recreated lazily on the next invocation; held subscriptions and warm caches are lost. Acceptable for 1a but worth validating in production telemetry before relying on it.

#### Phase 1a rollback switch

Phase 1a keeps the legacy renderer plugin execution path available behind a boot-time environment flag:

INSOMNIA_ENABLE_PLUGIN_BRIDGE=false

When unset or set to any other value, plugin calls use the hidden plugin window bridge.
When set to false, window.main.plugins.\* falls back to the legacy in-renderer execution path for the current app session.

This switch is intended as a developer and rollout safety valve during Phase 1a. It is not a user-facing feature and should be removed once the bridge path is fully validated.

### Phase 1b: full plugin isolation in hidden window

**Goal:** remove plugin code from the main renderer bundle entirely. The hidden window is the sole owner of plugin discovery, loading, and execution.

#### What changes

- `src/plugins/index.ts` and all plugin context modules (`plugins/context/`) removed from the renderer bundle
- Renderer has no direct import of plugin packages; it communicates only through the IPC bridge
- Plugin context modules that have `process.type === 'renderer'` guards must be audited carefully — see [inso CLI and `process.type` guards](#inso-cli-and-processtype-guards). Guards must be preserved for inso compatibility; any disambiguation between "app renderer" and "hidden plugin window" should use a dedicated flag, not `process.type`

#### What does not change

- Hidden window still runs with `nodeIntegration: true`
- Plugin export shape and author-visible behaviour unchanged
- inso CLI plugin paths unchanged

#### Deliverables

1. Renderer bundle contains no plugin module imports
2. All baseline tests still pass
3. inso CLI smoke-tested to confirm no regressions from `process.type` guard changes

### Phase 1c: disable `nodeIntegration` in the main window

**Goal:** harden the main BrowserWindow by removing its reliance on Node.js integration. This requires eliminating residual Node.js API usage in the renderer.

#### What changes (grouped by effort)

| Area                                 | Files                                                                                             | Fix                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Direct `import electron` in renderer | `routes/auth.clear-vault-key.tsx`                                                                 | Replace `ipcRenderer.emit` with `window.main` equivalent                                          |
| `process.env` in renderer            | `common/constants.ts`, `settings/plugins.tsx`                                                     | Expose `INSOMNIA_DATA_PATH` and `PORTABLE_EXECUTABLE_DIR` via preload                             |
| `fs` in response/network/scripts     | `models/helpers/response-operations.ts`, `script-executor.ts`, `network/grpc/write-proto-file.ts` | New IPC handlers in `src/main/ipc/`, exposed via preload                                          |
| Dynamic `require('electron')`        | `network/network.ts`                                                                              | Replace with static imports or `window.main`                                                      |
| `node:crypto` / `node:os`            | `sync/delta/diff.ts`, `sync/git/providers/gitlab.ts`, `templating/base-extension.ts`              | Replace with Web Crypto API (`globalThis.crypto.subtle`) where possible; IPC bridge for remainder |

These changes should land together in one PR where practical, since they all share the same prerequisite (Phase 1b complete) and the same goal (nodeIntegration: false on the main window).

#### What does not change

- Hidden window retains `nodeIntegration: true` — Phase 2 tightens that
- Plugin author behaviour unchanged
- inso CLI unaffected (Node.js process, no Electron renderer)

### Phase 2: sandbox hardening

**Goal:** replace the hidden window's `nodeIntegration: true` runtime with a strict sandbox. Introduce capability-based permissions, the new `rendererFunctions`/`mainFunctions` API shape, and `contextIsolation: true`.

#### What changes

- Hidden plugin window rebuilt with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- Plugin API context object replaces direct Node/Electron access
- Permission metadata and enforcement added for `mainFunctions`
- Legacy plugin exports mapped onto new API shape or deprecated with explicit warnings
- Settings UI for trust and permissions

#### Relationship to Phase 1

Phase 1 proves the IPC boundary and host lifecycle. Phase 2 tightens what crosses that boundary. Because networking is already in main after Phase 1, the remaining surface to lock down is constrained to the plugin context object.

## Recommendation

Start with a narrow POC:

- keep plugin discovery and loading in main
- run `rendererFunctions` in a separate host, not in the app UI renderer
- allow `mainFunctions` only for bundled plugins or explicitly trusted plugins
- expose one new preload bridge instead of many plugin-specific bridges

That keeps the first iteration aligned with the app's existing preload and IPC architecture while leaving room for a more isolated runtime later.

## Explicit deprecation stance

This plan assumes explicit deprecations are acceptable.

That means the new plugin system does not need to preserve all current plugin features in the first release. It should instead:

1. ship a clean new architecture for the low-risk features first
2. mark high-risk legacy features as deprecated early
3. provide a migration path for medium-risk legacy features in a second pass
4. leave high-risk legacy features on the old runtime until there is a dedicated replacement or a formal removal plan

## Migration difficulty summary

### Low-risk features

- `themes`

### Low-medium-risk features

- `documentActions`

### Medium-risk features

- `requestActions`
- `requestGroupActions`
- `workspaceActions`
- `unsafePluginMainActions`
- plugin data store APIs

### High-risk features

- `requestHooks`
- `responseHooks`
- `templateTags`
- renderer/worker dialog helpers
- network and response-body helpers tied to the current request pipeline

## Proposed delivery model

### Phase 1: lift and shift (1a → 1b → 1c)

The first phase moves plugin execution out of the app UI renderer without changing any plugin-visible behaviour. It is the prerequisite for all sandbox hardening work. It is delivered in three sub-phases.

#### Phase 1a goals (current PR)

- legacy behaviour baseline tests green in CI for all plugin export types
- all plugin invocations cross the IPC bridge to the hidden window
- zero behavioural regressions

#### Phase 1b goals

- plugin code removed from the main renderer bundle entirely
- hidden BrowserWindow is sole owner of plugin discovery, loading, and execution
- `process.type` guards in shared modules preserved for inso CLI compatibility (see [inso CLI and `process.type` guards](#inso-cli-and-processtype-guards))

#### Phase 1c goals

- `nodeIntegration: false` set on the main BrowserWindow
- all residual renderer-side Node.js API usage eliminated (direct Electron imports, `fs`, `process.env`, dynamic `require`, `node:crypto`/`node:os`)
- delivered as a single PR where practical, since all items share the same prerequisite (1b) and goal

#### Out of scope for all of Phase 1

- new plugin API surface or export shapes
- permission model or trust gates
- sandbox hardening on the hidden window
- deprecation warnings

#### Success criteria (Phase 1 complete)

- all existing plugins work without modification
- app UI renderer contains no direct `require()` or import of plugin packages
- all plugin invocations cross the IPC bridge
- main BrowserWindow runs with `nodeIntegration: false`
- inso CLI plugin behaviour unchanged

### Phase 2: sandbox hardening and new API surface

The second phase tightens the hidden window, introduces the new API shape, and migrates legacy features.

#### Goals

- hidden window runs with `contextIsolation: true` and `nodeIntegration: false`
- plugins access capabilities through a controlled context object only
- new `rendererFunctions` / `mainFunctions` export shape is live
- low-risk and medium-risk legacy features are migrated or deprecated

#### In scope

- hidden window rebuilt with strict sandbox settings
- plugin context API (`RendererPluginContext`, `MainPluginContext`)
- permission metadata and enforcement for `mainFunctions`
- `themes`
- `documentActions`
- `requestActions`, `requestGroupActions`, `workspaceActions`
- `unsafePluginMainActions` → `mainFunctions`
- plugin data store bridge
- settings UI for trust and permissions
- migration docs for plugin authors
- initial mutation / command protocol for action-style features

#### Still out of scope

- `requestHooks`
- `responseHooks`
- `templateTags`
- full Nunjucks sandbox convergence

#### Recommended compatibility strategy

- support legacy and new plugin exports side-by-side for one transition window
- map action-style exports onto new `rendererFunctions` internally where practical
- convert bundled `unsafePluginMainActions` first as the lowest-risk privileged migration
- add warnings that legacy exports are deprecated and will move to new API shape
- do not migrate hook- or templating-driven features until a dedicated replacement design exists

## Coexistence rules

Legacy and new exports may need to coexist during migration, but the registry should make that behavior explicit.

Recommended rules:

1. A plugin may export legacy-only or new-only APIs with no warning.
2. A plugin exporting both legacy and new APIs should load, but should receive a migration warning.
3. New APIs should not silently shadow legacy APIs with the same user-facing purpose.
4. The registry should log exactly which exports were accepted, deprecated, or ignored.
5. The settings UI and docs should expose the plugin's current mode: legacy, mixed, or new.

## Legacy feature mapping

| Current feature           | Phase 1 treatment             | Phase 2 treatment           | Notes                                                 |
| ------------------------- | ----------------------------- | --------------------------- | ----------------------------------------------------- |
| `themes`                  | moved to hidden window, works | declarative plugin metadata | Keep data-only                                        |
| `documentActions`         | moved to hidden window, works | `rendererFunctions`         | Lower risk than other actions                         |
| `requestActions`          | moved to hidden window, works | `rendererFunctions`         | Needs DTO or mutation-patch wrapper in Phase 2        |
| `requestGroupActions`     | moved to hidden window, works | `rendererFunctions`         | Same as request actions                               |
| `workspaceActions`        | moved to hidden window, works | `rendererFunctions`         | Same as request actions                               |
| `unsafePluginMainActions` | moved to hidden window, works | `mainFunctions`             | Best first migration candidate for privileged actions |
| plugin store APIs         | moved to hidden window, works | plugin bridge/context APIs  | Good fit for explicit capability APIs                 |
| `requestHooks`            | moved to hidden window, works | deprecated / later redesign | Do not force into Phase 2                             |
| `responseHooks`           | moved to hidden window, works | deprecated / later redesign | Do not force into Phase 2                             |
| `templateTags`            | moved to hidden window, works | separate redesign track     | Keep separate from first two phases                   |

## Deprecation plan

### Long-tail deprecations, not immediate removals

These features should be marked deprecated when the new architecture lands, but should remain on a separate legacy track until a replacement exists:

- `requestHooks`
- `responseHooks`
- `templateTags`
- any plugin feature that relies on unrestricted renderer Node access

The plan should not assume these features can be removed in the first two passes.

### Supported in transition

These can continue to work while the new system is introduced, but should gain migration guidance:

- `themes`
- `documentActions`
- `requestActions`
- `requestGroupActions`
- `workspaceActions`
- bundled `unsafePluginMainActions`

### Runtime behavior

- unsupported legacy exports in the new runtime should log a clear warning
- deprecated exports on the old runtime should log a migration warning
- docs should include a feature matrix: supported, deprecated, unsupported, planned
- hook and templating features should remain explicitly "legacy-supported" until a replacement plan is approved

## Pre-Phase 1: legacy behaviour baseline

Phase 1 must not break existing plugin behaviour. Before any structural changes are made, a test baseline must exist that covers how legacy plugin functions are invoked today and how errors are handled. Phase 1 does not begin until this baseline is in place and passing.

### What to capture

For each plugin export type, the baseline must cover:

| Export type               | Invocation shape                                 | Return value shape     | Error behaviour                                                  |
| ------------------------- | ------------------------------------------------ | ---------------------- | ---------------------------------------------------------------- |
| `templateTags`            | `render(context)` called with a mock tag context | rendered string        | thrown errors propagate to the template engine as a render error |
| `requestHooks`            | `hook(context)` called before request dispatch   | void / mutates context | thrown errors abort the request with an error message            |
| `responseHooks`           | `hook(context)` called after response received   | void / mutates context | thrown errors are logged; response is still returned             |
| `requestActions`          | menu item triggers `action(context)`             | void                   | thrown errors shown as a notification                            |
| `requestGroupActions`     | same as requestActions                           | void                   | same                                                             |
| `workspaceActions`        | same as requestActions                           | void                   | same                                                             |
| `documentActions`         | same as requestActions                           | void                   | same                                                             |
| `unsafePluginMainActions` | invoked by name with args                        | serializable result    | thrown errors returned as structured error to caller             |
| `themes`                  | queried by name for CSS vars                     | theme object           | missing theme falls back to default                              |

### What to write

1. **Unit tests for each export type** — test the current invocation path in isolation. Use a minimal fixture plugin (inline object, not a real package). Assert the return value and that a thrown error produces the expected downstream behaviour (abort, notification, fallback, etc.).

2. **Error propagation tests** — explicitly test the error path for each export type:
   - synchronous throw
   - rejected promise
   - non-Error thrown value (e.g. a plain string)

   Assert the error reaches the right handler and does not crash the app.

3. **IPC contract snapshot** — once the baseline tests pass, document the exact IPC message shapes that Phase 1 will introduce for each export type. These become the acceptance criteria for the Phase 1 IPC bridge: if a message shape changes, the test must be updated intentionally, not silently.

### Success criteria for baseline

- All export types have at least one happy-path test and one error-path test
- Tests run in CI without requiring a live Electron renderer (use unit test mocks for IPC/context)
- The test suite passes on the current `develop` branch before any Phase 1 work begins
- Any Phase 1 change that causes a baseline test to fail is treated as a regression, not an acceptable trade-off

### Where to put the tests

Co-locate unit tests with the plugin execution code in `packages/insomnia/src/plugins/`. Name them `*.test.ts` following the existing Vitest convention. The baseline tests are not a one-off — they remain in the suite permanently as the regression guard for the hidden window migration and for Phase 2 sandbox hardening.

## Concrete implementation slices

### Phase 1 slices

#### Phase 1a slices (current PR)

1. **Baseline tests**
   - write unit tests for each plugin export type covering happy path and error path
   - tests must pass on `develop` before any structural changes

2. **Hidden plugin window**
   - create and manage a hidden BrowserWindow from main (`nodeIntegration: true`, `show: false`)
   - define window lifecycle: created eagerly at app startup, kept alive until app exit
   - add IPC channel for plugin invocation and result return

3. **Bridge routing**
   - add IPC handler in hidden window for each current plugin capability type
   - redirect all app UI renderer plugin invocations through the bridge
   - plugin code still bundled with renderer at this stage (duplication, not isolation)

4. **Verification**
   - run baseline tests against the new routing; confirm zero regressions

#### Phase 1b slices

1. **Bundle separation**
   - remove `src/plugins/index.ts` and `plugins/context/` from the renderer bundle
   - audit all `process.type === 'renderer'` guards in shared modules — preserve them for inso; use `window.__PLUGIN_WINDOW__` or equivalent to distinguish hidden window from app renderer if needed
   - confirm renderer has zero direct plugin imports

2. **inso validation**
   - run inso CLI smoke tests to confirm `process.type` guard changes introduced no regressions

#### Phase 1c slices

1. **Remove direct Electron imports** — `routes/auth.clear-vault-key.tsx`: replace `ipcRenderer.emit` with `window.main`
2. **Expose env vars via preload** — `common/constants.ts`, `settings/plugins.tsx`: add `INSOMNIA_DATA_PATH` and `PORTABLE_EXECUTABLE_DIR` to preload bridge
3. **Bridge `fs` operations** — `models/helpers/response-operations.ts`, `script-executor.ts`, `network/grpc/write-proto-file.ts`: new IPC handlers in `src/main/ipc/`
4. **Remove dynamic `require('electron')`** — `network/network.ts`: replace with static imports or `window.main`
5. **Replace Node crypto/os** — `sync/delta/diff.ts`, `sync/git/providers/gitlab.ts`, `templating/base-extension.ts`: use `globalThis.crypto.subtle`; IPC bridge for remainder
6. **Flip the flag** — set `nodeIntegration: false` on the main BrowserWindow and run full test suite

### Phase 2 slices

1. **Window hardening**
   - rebuild hidden window with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
   - add plugin preload that exposes the context object only

2. **Registry layer**
   - add new plugin type definitions for `rendererFunctions` and `mainFunctions`
   - normalize legacy plugin exports onto new shape where possible
   - detect mixed-mode plugins and emit coexistence warnings

3. **Renderer host**
   - expose minimal `RendererPluginContext` to plugin code
   - route context API calls through IPC to main

4. **Main runtime**
   - create `mainFunctions` registry
   - add IPC invocation path with permission enforcement
   - enforce trust gate

5. **Legacy migration**
   - migrate `themes`, `documentActions`, action-style exports
   - move `unsafePluginMainActions` onto `mainFunctions`
   - define mutation/command protocol for action-style side effects

6. **Operationalization**
   - settings UI for trust and permissions
   - migration guide for plugin authors
   - runtime deprecation warnings for legacy exports

## Recommended sequencing

### Phase 1

**Phase 1a (current PR)** 0. Write and pass legacy behaviour baseline tests. Do not proceed until green in CI.

1. Create hidden plugin window in main; verify it can load a plugin module.
2. Add IPC bridge; redirect all renderer plugin invocations through it.
3. Run full test suite; confirm zero regressions.

**Phase 1b** 4. Remove plugin code from the renderer bundle entirely. 5. Audit and preserve all `process.type === 'renderer'` guards for inso; add `window.__PLUGIN_WINDOW__` flag if disambiguation is needed. 6. Run inso CLI smoke tests to confirm no regressions.

**Phase 1c** 7. Remove direct `import electron` and `require('electron')` from renderer. 8. Expose required `process.env` vars via preload. 9. Bridge `fs` operations in response/network/scripts via new IPC handlers. 10. Replace `node:crypto`/`node:os` with Web Crypto or IPC bridges. 11. Set `nodeIntegration: false` on the main BrowserWindow; run full test suite.

### Phase 2

6. Rebuild hidden window with `contextIsolation: true`, `nodeIntegration: false`.
7. Introduce plugin context API; prove one `rendererFunctions` call end-to-end.
8. Add `mainFunctions` registry and IPC invocation; prove one privileged call end-to-end.
9. Convert one bundled `unsafePluginMainActions` to `mainFunctions`.
10. Add `themes` and `documentActions` on the new API.
11. Define and prototype the mutation / command protocol.
12. Migrate `requestActions`, `requestGroupActions`, `workspaceActions`.
13. Publish deprecation guidance for `requestHooks`, `responseHooks`, `templateTags`.

## Key decisions for this plan

**Phase 1 must not break existing plugins.** The hidden window with `nodeIntegration: true` is an intentional trade-off: it buys the structural separation needed to later apply the sandbox, without requiring plugin authors to change anything first. Any breakage in Phase 1 is a regression, not an accepted trade-off.

**Phase 1 is three sub-phases, not one.** 1a proves the bridge; 1b achieves true isolation; 1c hardens the main window. Each is a separate PR. 1c items should land together where practical since they share the same prerequisite and goal.

**`process.type === 'renderer'` guards are for inso, not just renderer detection.** The inso CLI reuses renderer code paths but loads implementations directly rather than via IPC. These guards must be preserved in shared modules during Phase 1b. See [inso CLI and `process.type` guards](#inso-cli-and-processtype-guards).

**Phase 2 is where the new API surface lands.** The `rendererFunctions` / `mainFunctions` shapes, permission model, and settings UI belong in Phase 2. They should not block Phase 1 delivery.

**Hook and templating features stay on the legacy path.** `requestHooks`, `responseHooks`, and `templateTags` move to the hidden window in Phase 1 (preserved, not redesigned), and remain on a separate redesign track after Phase 2 with explicit deprecation messaging.

## What Remains to Disable nodeIntegration in the Renderer (Phase 2)

## Blockers (must fix before flipping the switch)

1. createPlugin uses Node.js fs/path directly in the renderer

packages/insomnia/src/plugins/create.ts imports fs and path from Node and is called directly from two renderer entry points: the create-plugin modal and root.tsx (theme installation). This is the most straightforward fix — move the filesystem writes to an IPC handler  
 in the main process and call it via window.main.

2. Template tag extensions still run inside the renderer's Web Worker

This is the largest remaining piece. Nunjucks rendering runs in a Web Worker (ui/worker/templating-handler.ts), but the plugin template tag extensions (base-extension-worker.ts) are instantiated and executed inside that worker, which lives inside the renderer process.
The worker already has nodeIntegrationInWorker: false, so the web worker is sandboxed — but the template tag plugin code still lives on the renderer side of the fence. For nodeIntegration: false on the renderer, all plugin code (including template tags) needs to move
out.

The cleanest solution — and the one you're already thinking about — is to move the entire templating pipeline into the plugin window. Template tags and request/action plugins would then share the same Node.js process and DB proxy. The custom  
 insomnia-templating-worker-database:// protocol (currently used by the web worker to reach the main process for DB calls, network requests, file reads, etc.) could be replaced entirely with the existing IPC database proxy. The renderer side becomes a thin caller:
serialize the render context, send it over IPC, get back a rendered string.

3. webviewTag: true on the main window

response-web-view.tsx uses Electron's <webview> tag to render HTML response previews. The webviewTag: true setting in window-utils.ts:204 must remain until this is replaced. With contextIsolation: true the webview still functions, but it's a meaningful attack surface —
a malicious API response could attempt to exploit the webview. The right long-term replacement is a sandboxed <iframe srcdoc> (no src, no allow attributes), which achieves the same preview without a privileged Electron component.

---

## Minor Cleanup (not blockers, but needed for correctness)

- packages/insomnia/src/network/cancellation.ts:52 — the process.type === 'renderer' branch guard can be deleted once the renderer no longer has process in scope; the non-renderer branch there is unreachable from the renderer anyway.

---

## Suggested Phase 2 Work Order

┌─────┬───────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
 │ # │ Task │ Approach │
├─────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ 1 │ Move createPlugin to main process │ Add IPC handler, replace fs/path calls with window.main.createPlugin(...) │
├─────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ 2 │ Move templating pipeline to plugin window │ The plugin window replaces the web worker; renderer calls window.main.plugins.renderTemplate(context) over IPC; drop the insomnia-templating-worker-database:// protocol │  
 ├─────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ 3 │ Replace <webview> with sandboxed <iframe> │ Removes the last reason for webviewTag: true │  
 ├─────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ 4 │ Flip the switch │ Set nodeIntegration: false, contextIsolation: true on the main renderer window │  
 └─────┴───────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

The templating migration (item 2) is the most work but also the most architecturally coherent outcome — all plugin code (actions, hooks, template tags) runs in one place with one shared DB proxy, one Node.js context, and one IPC boundary back to the renderer.
