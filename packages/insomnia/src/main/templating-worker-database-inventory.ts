// S1: the checked-in scoping inventory for every protocol-dispatch handler in `pluginToMainAPI`.
//
// Two classes of handler share that map, and only the first is capability-gated:
//   1. Plugin-facing bridge calls — reachable from inside the sandbox via `__bridge`, gated by
//      `BRIDGE_PATH_CAPABILITIES` (default-deny; `filterByCapabilities` rejects an unmapped path).
//   2. Directly-dispatchable orchestration handlers — every `pluginToMainAPI` key is routed by
//      `resolveDbByKey`, not only the ones reached through a wrapper, so a handler like
//      `response.setBody` or `plugin.runUserResponseHook` can be invoked straight over the protocol.
//      These are NOT in the capability map; their safety rests on an inline trust/ownership check.
//
// This inventory records, for every handler, its side-effect class, its capability (or null when it's
// host-only orchestration), the guard(s) that actually protect it, and the blast radius if that guard
// is wrong. `templating-worker-database-inventory.test.ts` enforces it against the live handler map so
// it cannot drift: a new handler with no row, a capability that disagrees with `BRIDGE_PATH_CAPABILITIES`,
// or a directly-dispatchable I/O handler whose only claimed defense is the (bypassable) bridge
// capability all fail a test rather than shipping.

/** What a handler can touch. Drives which guards are mandatory. */
export type SideEffectClass =
  | 'pure' // compute only, no host state
  | 'model-read' // reads a DB model (request/workspace/cookieJar/response/settings)
  | 'fs-read' // reads a file off disk
  | 'fs-write' // writes a file to disk
  | 'network' // makes an outbound network request
  | 'credential' // reads or writes stored credentials
  | 'storage' // reads or writes plugin key/value storage
  | 'app' // drives a UI/app affordance (dialog, clipboard, open-in-browser)
  | 'sandbox-orchestration'; // runs/inspects plugin code; host-only, not a plugin-facing capability

/** The mechanism(s) that actually protect a handler. */
export type Guard =
  | 'capability' // gated by BRIDGE_PATH_CAPABILITIES at the in-sandbox bridge (filterByCapabilities)
  | 'path-allowlist' // caller path constrained to a secured-folder allowlist (secureReadFile)
  | 'body-path-ownership' // caller bodyPath must belong to the claimed response (assert*BodyPath*Ownership)
  | 'trusted-plugin' // plugin identity re-resolved from the registry, never caller-supplied (resolveTrustedPlugin)
  | 'bundle-allowlist' // only first-party bundle plugins (getAppBundlePlugins / appBundlePluginNames)
  | 'registry-lookup' // target resolved from the trusted getTemplateTags/getX registry, not caller input
  | 'plugin-scoped' // storage keyed/scoped by the owning plugin name
  | 'none'; // pure — no sensitive sink to guard

export interface HandlerInventoryEntry {
  /** `pluginToMainAPI` key. */
  path: string;
  sideEffect: SideEffectClass;
  /**
   * The capability group from `BRIDGE_PATH_CAPABILITIES`, or null when the handler is host-only
   * orchestration (not reachable from inside the sandbox and not a plugin-declarable capability).
   */
  capability: string | null;
  /** Everything that protects this handler. A directly-dispatchable I/O handler needs more than 'capability'. */
  guards: Guard[];
  /** One line: what an attacker gains if the guard(s) fail. */
  blastRadius: string;
}

// Capability paths served by a bridge OTHER than the pluginToMainAPI protocol (so they legitimately
// have no pluginToMainAPI handler). `util.render` is handled by the render bridge / capUtilRenderDepth.
export const NON_DB_BRIDGE_PATHS = ['util.render'];

export const HANDLER_INVENTORY: HandlerInventoryEntry[] = [
  // --- util (pure compute) ---
  {
    path: 'nodeOS',
    sideEffect: 'pure',
    capability: 'util',
    guards: ['capability'],
    blastRadius: 'discloses host OS/arch strings',
  },
  {
    path: 'decode',
    sideEffect: 'pure',
    capability: 'util',
    guards: ['capability'],
    blastRadius: 'none beyond CPU (pure decode)',
  },
  {
    path: 'encode',
    sideEffect: 'pure',
    capability: 'util',
    guards: ['capability'],
    blastRadius: 'none beyond CPU (pure encode)',
  },

  // --- model reads ---
  {
    path: 'request.getById',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads any request document by id',
  },
  {
    path: 'request.getAncestors',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads a request ancestry chain',
  },
  {
    path: 'workspace.getById',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads any workspace document by id',
  },
  {
    path: 'cookieJar.getOrCreateForParentId',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads/creates a cookie jar for a workspace',
  },
  {
    path: 'cookieJar.getCookiesForUrl',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads cookies matching a url',
  },
  {
    path: 'response.getLatestForRequestId',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads the latest response metadata for a request',
  },
  {
    path: 'settings.get',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads app settings',
  },

  // --- response body I/O (file-backed, caller-supplied bodyPath → ownership-checked) ---
  {
    path: 'response.getBodyBuffer',
    sideEffect: 'fs-read',
    capability: 'models.read',
    guards: ['capability', 'body-path-ownership'],
    blastRadius: 'reads an arbitrary file if bodyPath ownership is not enforced',
  },
  {
    path: 'response.setBody',
    sideEffect: 'fs-write',
    capability: 'models.read',
    guards: ['capability', 'body-path-ownership'],
    blastRadius: 'overwrites another response body (or arbitrary file) if bodyPath ownership is not enforced',
  },

  // --- filesystem read (caller path → allowlist-contained) ---
  {
    path: 'readFile',
    sideEffect: 'fs-read',
    capability: 'fs-read',
    guards: ['capability', 'path-allowlist'],
    blastRadius: 'reads an arbitrary file if the secured-folder allowlist is not enforced',
  },

  // --- storage (plugin-scoped key/value) ---
  {
    path: 'pluginData.hasItem',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'probes another plugin’s storage keys if not scoped',
  },
  {
    path: 'pluginData.setItem',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'writes another plugin’s storage if not scoped',
  },
  {
    path: 'pluginData.getItem',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'reads another plugin’s storage if not scoped',
  },
  {
    path: 'pluginData.removeItem',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'deletes another plugin’s storage if not scoped',
  },
  {
    path: 'pluginData.clear',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'clears another plugin’s storage if not scoped',
  },
  {
    path: 'pluginData.all',
    sideEffect: 'storage',
    capability: 'storage',
    guards: ['capability', 'plugin-scoped'],
    blastRadius: 'reads all of another plugin’s storage if not scoped',
  },

  // --- network ---
  {
    path: 'network.sendRequest',
    sideEffect: 'network',
    capability: 'network',
    guards: ['capability'],
    blastRadius: 'SSRF / arbitrary outbound request with side effects',
  },
  {
    path: 'network.sendRequestWithoutSideEffects',
    sideEffect: 'network',
    capability: 'network',
    guards: ['capability'],
    blastRadius: 'SSRF / arbitrary outbound request',
  },

  // --- model reads (continued: OAuth tokens scoped to request) ---
  {
    path: 'oAuth2Token.getByRequestId',
    sideEffect: 'model-read',
    capability: 'models.read',
    guards: ['capability'],
    blastRadius: 'reads OAuth2 tokens associated with a request',
  },

  // --- credentials ---
  {
    path: 'cloudCredential.getById',
    sideEffect: 'credential',
    capability: 'credentials',
    guards: ['capability'],
    blastRadius: 'reads a stored cloud credential',
  },
  {
    path: 'cloudCredential.update',
    sideEffect: 'credential',
    capability: 'credentials',
    guards: ['capability'],
    blastRadius: 'overwrites a stored cloud credential',
  },

  // --- app / UI affordances ---
  {
    path: 'openInBrowser',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'opens an arbitrary URL in the default browser',
  },
  {
    path: 'app.alert',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'shows a modal alert',
  },
  {
    path: 'app.dialog',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'shows a modal dialog',
  },
  {
    path: 'app.prompt',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'shows a modal prompt',
  },
  {
    path: 'app.getPath',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'discloses an app directory path',
  },
  {
    path: 'app.showSaveDialog',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'shows a native save dialog',
  },
  {
    path: 'app.clipboard.readText',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'reads the system clipboard',
  },
  {
    path: 'app.clipboard.writeText',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'writes the system clipboard',
  },
  {
    path: 'app.clipboard.clear',
    sideEffect: 'app',
    capability: 'app',
    guards: ['capability'],
    blastRadius: 'clears the system clipboard',
  },

  // --- sandbox orchestration (host-only; NOT a plugin capability; directly dispatchable) ---
  {
    path: 'plugin.getBundlePluginTemplateTags',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['bundle-allowlist'],
    blastRadius: 'lists first-party bundle tag metadata (trusted)',
  },
  {
    path: 'plugin.executeBundlePluginTag',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['bundle-allowlist'],
    blastRadius: 'runs non-bundle code if the bundle allowlist is not enforced',
  },
  {
    path: 'plugin.executeBundlePluginMainAction',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['bundle-allowlist'],
    blastRadius: 'runs non-bundle main-process code if the bundle allowlist is not enforced',
  },
  {
    path: 'plugin.getUserPluginTemplateTags',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['registry-lookup'],
    blastRadius: 'lists user tag metadata from the trusted registry',
  },
  {
    path: 'plugin.executeUserPluginTag',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['registry-lookup'],
    blastRadius: 'runs a plugin tag; target resolved from the trusted registry, not caller input',
  },
  {
    path: 'plugin.discoverUserPluginExports',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['trusted-plugin'],
    blastRadius: 'evaluates plugin source from a caller-supplied directory if identity is not re-resolved',
  },
  {
    path: 'plugin.runUserRequestHook',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['trusted-plugin'],
    blastRadius: 'runs a hook from a caller-supplied directory/permissions if identity is not re-resolved',
  },
  {
    path: 'plugin.runUserResponseHook',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['trusted-plugin', 'body-path-ownership'],
    blastRadius: 'runs a hook that can redirect setBody onto another response if identity/ownership are not enforced',
  },
  {
    path: 'plugin.runUserAction',
    sideEffect: 'sandbox-orchestration',
    capability: null,
    guards: ['trusted-plugin'],
    blastRadius: 'runs an action from a caller-supplied directory/permissions if identity is not re-resolved',
  },
];

/** Handlers reachable from inside the sandbox (capability-gated). */
export const pluginFacingInventory = (): HandlerInventoryEntry[] =>
  HANDLER_INVENTORY.filter(e => e.capability !== null);

/** Host-only orchestration handlers — directly dispatchable, never capability-gated. */
export const hostOnlyInventory = (): HandlerInventoryEntry[] => HANDLER_INVENTORY.filter(e => e.capability === null);

/** Renders one row for the human-readable print script. */
export const formatInventoryEntry = (e: HandlerInventoryEntry): string =>
  `${e.path.padEnd(38)} ${e.sideEffect.padEnd(22)} ${(e.capability ?? '(host-only)').padEnd(14)} ${e.guards.join('+')}`;

export const formatInventory = (): string[] => HANDLER_INVENTORY.map(formatInventoryEntry);
