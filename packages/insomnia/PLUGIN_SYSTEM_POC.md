# Plugin System POC Outline

## Goal

Design a new plugin system for the Electron app that supports:

- `rendererFunctions` for UI-safe extension points in the renderer
- `mainFunctions` for privileged capabilities that must run in the main process
- a sandbox model that keeps third-party plugins off direct Electron and Node APIs unless explicitly allowed

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

That means pass 1 must explicitly move the system from:

```text
renderer imports plugin helpers -> renderer fetches plugin exports -> renderer executes plugin code
```

to:

```text
main discovers and registers plugins -> renderer requests descriptors -> renderer invokes through bridge only
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

## Host decision required before implementation

The plan assumes a "sandboxed plugin host" for `rendererFunctions`, but that host is not yet defined.

Pass 1 should make an explicit choice between options such as:

- dedicated hidden BrowserWindow
- worker-based host
- utility process
- another isolated Electron runtime

This decision affects:

- module loading strategy
- serialization boundaries
- whether `rendererFunctions` can call UI-oriented helpers at all
- startup cost and caching behavior
- how close the host can get to `contextIsolation: true`

The POC should treat host selection as a first-class deliverable, not an implementation detail.

## Sandbox model

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
3. privileged work always crosses the preload boundary
4. main-process plugin handlers remain the only place with privileged Electron access
5. the app UI renderer never imports plugin packages directly

That means the plugin system should be designed so the renderer is a client of the plugin system, not the owner of plugin loading, even if the current app still has `nodeIntegration: true` in places.

## Suggested preload API

```ts
type PluginBridgeAPI = {
  invokeMain: (pluginName: string, functionName: string, args?: unknown) => Promise<unknown>;
  invokeRenderer: (pluginName: string, functionName: string, args?: unknown) => Promise<unknown>;
  listFunctions: () => Promise<{
    pluginName: string;
    mainFunctions: string[];
    rendererFunctions: string[];
  }[]>;
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

## Open design questions

1. Should public plugins ever get `mainFunctions`, or should that be opt-in behind a trust prompt?
2. Should `mainFunctions` run in the main process directly, or in a dedicated utility process with a stricter bridge?
3. Should plugin permissions be granted per plugin, per function, or per capability group?
4. Should bundled first-party plugins keep a separate trusted path?
5. What is the concrete host for `rendererFunctions`?
6. What is the minimum viable mutation / command protocol for migrating legacy actions?

## POC phases

### Phase 1: registry and bridge

- Add plugin type definitions for `rendererFunctions` and `mainFunctions`
- Register functions in the main-owned plugin registry
- Add `window.plugins.invokeMain`
- Add `window.plugins.invokeRenderer`

### Phase 2: permissions

- Add permission metadata and enforcement
- Add settings UI for plugin trust and permissions

### Phase 3: sandbox hardening

- Remove any plugin dependence on renderer Node access
- Validate behavior under `contextIsolation: true`

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

### First pass: architecture POC

The first pass should prove that the new architecture is viable without taking on the hardest migration problems.

#### Goals

- define the new plugin manifest and export shape
- load and register plugins in the main process
- expose a narrow preload bridge
- choose and document the `rendererFunctions` host
- support trusted execution for a small set of sample plugin functions
- make deprecations visible in docs and runtime warnings

#### In scope

- plugin registry and export normalization
- preload bridge for plugin invocation
- main-process registry for `mainFunctions`
- sandboxed plugin host for `rendererFunctions`
- host selection and host lifecycle notes
- basic permission model for `mainFunctions`
- plugin discovery compatibility with the existing install location
- runtime warnings for deprecated legacy exports

#### Out of scope

- migration of request/response hooks
- migration of template tags
- worker-specific sandbox work
- full compatibility layer for mutable request/response models
- settings UI for fine-grained permissions

#### Suggested output

1. one sample bundled plugin using `rendererFunctions`
2. one sample bundled plugin using `mainFunctions`
3. one renderer entry point showing invocation through the new bridge
4. a written decision on the `rendererFunctions` host
5. a deprecation table for unsupported legacy exports

#### Success criteria

- plugin loader can detect and register new-style plugins
- renderer code can call a registered `rendererFunction` without loading plugin code into the app UI runtime
- renderer code can call a registered `mainFunction` through preload and IPC
- `mainFunctions` are blocked unless the plugin is trusted
- unsupported legacy features produce explicit warnings instead of silent partial behavior
- the chosen renderer host is proven viable for at least one real plugin call path

## Second pass: feature-bearing implementation

The second pass should make the new system useful enough for real adoption.

#### Goals

- support `themes`
- support production-ready `rendererFunctions`
- support production-ready `mainFunctions`
- migrate low-risk and medium-risk legacy features that fit the new model

#### In scope

- `themes`
- `documentActions`
- `requestActions`
- `requestGroupActions`
- `workspaceActions`
- `unsafePluginMainActions` replacement through public or semi-public `mainFunctions`
- plugin data store bridge
- settings UI for trust and permission review
- migration docs for plugin authors
- initial mutation / command protocol for migrated legacy actions

#### Still out of scope

- `requestHooks`
- `responseHooks`
- `templateTags`
- full Nunjucks sandbox convergence

#### Recommended compatibility strategy

- support legacy and new plugin exports side-by-side for one transition window
- map medium-risk action-style exports onto new `rendererFunctions` internally where practical
- convert internal bundled `unsafePluginMainActions` first
- add warnings that legacy action exports are deprecated and will move to `rendererFunctions` / `mainFunctions`
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

| Current feature | New home | Pass | Notes |
|---|---|---:|---|
| `themes` | declarative plugin metadata | 2 | Keep data-only |
| `documentActions` | `rendererFunctions` | 2 | Lower risk than other actions, but still needs host-safe context |
| `requestActions` | `rendererFunctions` | 2 | Likely needs DTO or mutation-patch wrapper |
| `requestGroupActions` | `rendererFunctions` | 2 | Same as request actions |
| `workspaceActions` | `rendererFunctions` | 2 | Same as request actions |
| `unsafePluginMainActions` | `mainFunctions` | 2 | Best first migration candidate for privileged actions |
| plugin store APIs | plugin bridge/context APIs | 2 | Good fit for explicit capability APIs |
| `requestHooks` | deprecated / later redesign | later | Do not force into early POC |
| `responseHooks` | deprecated / later redesign | later | Do not force into early POC |
| `templateTags` | separate redesign track | later | Keep separate from first two passes |

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

## Concrete implementation slices

### Pass 1 slices

1. **Registry layer**
   - add new plugin definitions
   - normalize plugin module exports
   - identify legacy vs new-style plugins
   - detect mixed-mode plugins and emit coexistence warnings

2. **Host decision**
   - pick the concrete host for `rendererFunctions`
   - document lifecycle, loading model, and serialization boundary

3. **Renderer host**
   - create `rendererFunctions` execution path in the selected host
   - expose a minimal plugin context

4. **Main runtime**
   - create `mainFunctions` registry
   - add IPC invocation path
   - enforce trust gate

5. **Developer experience**
   - add one bundled example plugin
   - add docs and runtime warnings

### Pass 2 slices

1. **Themes**
   - support declarative theme registration in the new registry

2. **Low-medium legacy actions**
   - migrate `documentActions`
   - define the smallest viable command pattern needed for safe execution

3. **Medium-risk legacy actions**
   - adapt action-style exports onto `rendererFunctions`
   - introduce DTO or mutation-patch conventions where needed

4. **Privileged function migration**
   - move bundled `unsafePluginMainActions` onto `mainFunctions`
   - define the initial public permission list

5. **Operationalization**
   - add settings UI for trust and permissions
   - add migration guide for plugin authors

## Recommended sequencing

1. Land the pass 1 registry, bridge, and host decision.
2. Prove one `rendererFunctions` call path and one `mainFunctions` call path end-to-end.
3. Convert one bundled privileged action to `mainFunctions`.
4. Add `themes`.
5. Migrate `documentActions`.
6. Define and prototype the action mutation / command protocol.
7. Adapt request/workspace action-style features.
8. Publish deprecation guidance for hooks and template tags.

## Key decision for this plan

The new system should optimize for a clean future architecture, not full backward compatibility. The first two passes should deliver a credible plugin platform for:

- `rendererFunctions`
- `mainFunctions`
- `themes`
- low-medium and medium-risk legacy action features once a host and command model exist

The remaining hook- and templating-heavy features should move on a separate redesign track with explicit deprecation messaging.
