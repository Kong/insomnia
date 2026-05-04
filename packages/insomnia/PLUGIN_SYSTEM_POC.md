# Plugin System POC Outline

## Goal

Design a new plugin system for the Electron app that supports:

- `rendererFunctions` for UI-safe extension points in the renderer
- `mainFunctions` for privileged capabilities that must run in the main process
- a sandbox model that keeps third-party plugins off direct Electron and Node APIs unless explicitly allowed

The migration is split into two phases to avoid breaking existing plugin behaviour:

- **Phase 1:** move all plugin loading and execution into a dedicated hidden BrowserWindow with `nodeIntegration: true`, and move networking into the main process. No API surface changes for plugin authors — existing plugins continue to work.
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

Phase 1 moves the system from:

```text
renderer imports plugin helpers -> renderer fetches plugin exports -> renderer executes plugin code
```

to:

```text
hidden plugin window loads plugins -> renderer requests execution via IPC bridge -> hidden window executes and returns result
```

Plugin trust level is unchanged in Phase 1. The hidden window still has `nodeIntegration: true`.

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

| Option | Phase 1 suitability | Notes |
|--------|-------------------|-------|
| Hidden BrowserWindow (nodeIntegration: true) | Best | Full Node/Electron compat, easy IPC, matches current plugin expectations |
| Worker | Poor | No Node builtins, breaks most existing plugins |
| Utility process | Poor | No DOM, breaks renderer-oriented plugin APIs |
| Second full window | Overkill | Hidden window achieves the same isolation with less overhead |

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

### Phase 1: lift and shift (non-breaking)

**Goal:** move all plugin loading and execution out of the app UI renderer into a hidden BrowserWindow with `nodeIntegration: true`. Move plugin networking calls to main. No change to existing plugin behaviour.

#### What changes

- All calls to `src/plugins/index.ts` that currently run in the renderer are redirected through IPC to the hidden plugin window
- The hidden window owns plugin discovery, loading, and execution
- Network requests made by plugin code (e.g. in requestHooks/responseHooks) move to main-process handlers
- The app UI renderer communicates with plugins only through the preload bridge

#### What does not change

- Plugin export shape (`templateTags`, `requestHooks`, `responseHooks`, etc.) is unchanged
- Plugin authors do not need to update anything
- `nodeIntegration: true` is preserved in the hidden window so all existing Node/Electron usage continues
- No permission model is enforced yet — plugins have the same trust level as today, just in a separate window

#### Deliverables

1. Hidden plugin window created and managed from main
2. Plugin discovery and loading moved into the hidden window
3. IPC bridge added so the app UI renderer can invoke plugin capabilities
4. Networking extracted from renderer plugin execution paths and routed through main
5. Existing plugin behaviour verified against the current test suite
6. No new plugin API surface — purely structural

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

### Phase 1: lift and shift

The first phase moves plugin execution out of the app UI renderer without changing any plugin-visible behaviour. It is the prerequisite for all sandbox hardening work.

#### Goals

- all plugin loading and execution runs in a hidden BrowserWindow, not in the app UI renderer
- plugin networking moves to the main process
- zero breaking changes for existing plugins
- app UI renderer interacts with plugins only through the preload bridge

#### In scope

- hidden plugin window creation and lifecycle management
- IPC bridge between app UI renderer and hidden plugin window
- redirect of all current renderer-side plugin invocations through the bridge
- extraction of networking from renderer plugin execution paths into main
- plugin discovery compatibility with the existing install location

#### Out of scope

- new plugin API surface or export shapes
- permission model or trust gates
- sandbox hardening
- deprecation warnings

#### Success criteria

- all existing plugins work without modification
- app UI renderer contains no direct `require()` or import of plugin packages
- all plugin invocations cross the IPC bridge
- networking from plugin hooks runs in main, not in any renderer

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

| Current feature           | Phase 1 treatment             | Phase 2 treatment               | Notes                                                            |
| ------------------------- | ----------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `themes`                  | moved to hidden window, works | declarative plugin metadata     | Keep data-only                                                   |
| `documentActions`         | moved to hidden window, works | `rendererFunctions`             | Lower risk than other actions                                    |
| `requestActions`          | moved to hidden window, works | `rendererFunctions`             | Needs DTO or mutation-patch wrapper in Phase 2                   |
| `requestGroupActions`     | moved to hidden window, works | `rendererFunctions`             | Same as request actions                                          |
| `workspaceActions`        | moved to hidden window, works | `rendererFunctions`             | Same as request actions                                          |
| `unsafePluginMainActions` | moved to hidden window, works | `mainFunctions`                 | Best first migration candidate for privileged actions            |
| plugin store APIs         | moved to hidden window, works | plugin bridge/context APIs      | Good fit for explicit capability APIs                            |
| `requestHooks`            | moved to hidden window, works | deprecated / later redesign     | Do not force into Phase 2                                        |
| `responseHooks`           | moved to hidden window, works | deprecated / later redesign     | Do not force into Phase 2                                        |
| `templateTags`            | moved to hidden window, works | separate redesign track         | Keep separate from first two phases                              |

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

| Export type               | Invocation shape | Return value shape | Error behaviour |
| ------------------------- | ---------------- | ------------------ | --------------- |
| `templateTags`            | `render(context)` called with a mock tag context | rendered string | thrown errors propagate to the template engine as a render error |
| `requestHooks`            | `hook(context)` called before request dispatch | void / mutates context | thrown errors abort the request with an error message |
| `responseHooks`           | `hook(context)` called after response received | void / mutates context | thrown errors are logged; response is still returned |
| `requestActions`          | menu item triggers `action(context)` | void | thrown errors shown as a notification |
| `requestGroupActions`     | same as requestActions | void | same |
| `workspaceActions`        | same as requestActions | void | same |
| `documentActions`         | same as requestActions | void | same |
| `unsafePluginMainActions` | invoked by name with args | serializable result | thrown errors returned as structured error to caller |
| `themes`                  | queried by name for CSS vars | theme object | missing theme falls back to default |

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

1. **Hidden plugin window**
   - create and manage a hidden BrowserWindow from main (`nodeIntegration: true`, `show: false`)
   - define window lifecycle: created on first plugin use, kept alive until app exit
   - add IPC channel for plugin invocation and result return

2. **Plugin loader redirect**
   - move `src/plugins/index.ts` plugin discovery and loading into the hidden window
   - add IPC handler in hidden window for each current plugin capability type
   - redirect app UI renderer calls through `window.plugins` preload bridge

3. **Networking extraction**
   - identify all network calls triggered from renderer plugin execution paths
   - move those calls to main-process IPC handlers
   - hidden window calls main via IPC for network operations; main returns serialized responses

4. **Verification**
   - run existing plugin tests against the new routing
   - confirm zero behavioral regressions for all plugin export types

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

0. **Write and pass the legacy behaviour baseline** (see [Pre-Phase 1](#pre-phase-1-legacy-behaviour-baseline)). Do not begin steps 1–5 until baseline tests are green in CI.
1. Create hidden plugin window in main; verify it can load a plugin module.
2. Move plugin discovery and loading into hidden window via IPC.
3. Redirect all app UI renderer plugin calls through the preload bridge.
4. Extract networking from renderer plugin execution paths into main.
5. Run full test suite; confirm zero regressions against the baseline.

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

**Networking moves to main in Phase 1, not Phase 2.** Extracting network calls from renderer plugin paths is lower risk in Phase 1 (while Node APIs are still available) and reduces the surface that needs sandboxing in Phase 2.

**Phase 2 is where the new API surface lands.** The `rendererFunctions` / `mainFunctions` shapes, permission model, and settings UI belong in Phase 2. They should not block Phase 1 delivery.

**Hook and templating features stay on the legacy path.** `requestHooks`, `responseHooks`, and `templateTags` move to the hidden window in Phase 1 (preserved, not redesigned), and remain on a separate redesign track after Phase 2 with explicit deprecation messaging.
