/**
 * The host side of the sandbox bridge. The sandbox calls `__hostBridge(path, bodyJson)`; that lands
 * here, runs the real async work, and the result is marshaled back as a JSON string.
 *
 * `HostBridge` is injected at the boundary so the sandbox itself stays runtime-agnostic:
 *  - renderer  → wraps `fetchFromTemplateWorkerDatabase(path, body)` (IPC over the custom protocol)
 *  - main/CLI  → dispatches directly to the `pluginToMainAPI` handler map (no IPC hop)
 *  - tests     → a hand-built handler map
 *
 * The `path` strings are the exact `PluginToMainAPIPaths` keys already handled in
 * `main/templating-worker-database.ts`, so the existing host handlers are reused verbatim.
 */
export type HostBridge = (path: string, body: unknown) => Promise<unknown>;

/**
 * Build a HostBridge from a `pluginToMainAPI`-shaped handler map. Used for the in-process
 * (main/CLI) path and by tests; the renderer supplies its own fetch-based bridge instead.
 */
export const createMapBridge =
  (handlers: Record<string, (body: any) => Promise<unknown>>): HostBridge =>
  async (path, body) => {
    // Own-property + function check so a path like "constructor"/"hasOwnProperty" can't resolve to
    // an inherited Object.prototype member instead of a real handler.
    const handler = Object.prototype.hasOwnProperty.call(handlers, path) ? handlers[path] : undefined;
    if (typeof handler !== 'function') {
      throw new TypeError(`No host bridge handler registered for "${path}"`);
    }
    return handler(body);
  };

/**
 * Capability groups (axis 2, sandbox plan C1). Every side-effecting bridge path belongs to exactly
 * one group; a plugin may reach a path only if its effective grant includes that group. Names match
 * what a manifest declares in `insomnia.permissions.capabilities`.
 */
export type Capability =
  | 'render' // recursive template render (util.render)
  | 'models.read' // read-only model + settings lookups
  | 'util' // pure/benign host helpers (nodeOS/decode/encode) — mirrors the built-in os/base64 tags
  | 'crypto' // sync host crypto (no bridge path; kept for profile/manifest consistency)
  | 'network' // sending HTTP requests
  | 'storage' // per-plugin key/value store (pluginData.*)
  | 'fs-read' // reading files off disk (readFile)
  | 'credentials' // cloud provider credential read/write
  | 'app'; // host UI + shell (dialogs, clipboard, openInBrowser)

/**
 * The single source of truth mapping every sandbox-callable bridge path to its capability. Kept in
 * sync with the `__bridge("…")` calls in `in-sandbox-bootstrap.ts` by a completeness unit test — a
 * new bridge path added there without an entry here fails that test (fail-closed, never ungated).
 */
export const BRIDGE_PATH_CAPABILITIES: Record<string, Capability> = {
  'util.render': 'render',

  'request.getById': 'models.read',
  'request.getAncestors': 'models.read',
  'workspace.getById': 'models.read',
  'oAuth2Token.getByRequestId': 'models.read',
  'cookieJar.getOrCreateForParentId': 'models.read',
  'cookieJar.getCookiesForUrl': 'models.read',
  'response.getLatestForRequestId': 'models.read',
  'response.getBodyBuffer': 'models.read',
  'settings.get': 'models.read',

  'nodeOS': 'util',
  'decode': 'util',
  'encode': 'util',

  'network.sendRequest': 'network',
  'network.sendRequestWithoutSideEffects': 'network',

  'pluginData.hasItem': 'storage',
  'pluginData.setItem': 'storage',
  'pluginData.getItem': 'storage',
  'pluginData.removeItem': 'storage',
  'pluginData.clear': 'storage',
  'pluginData.all': 'storage',

  'readFile': 'fs-read',

  'cloudCredential.getById': 'credentials',
  'cloudCredential.update': 'credentials',

  'app.alert': 'app',
  'app.dialog': 'app',
  'app.prompt': 'app',
  'app.getPath': 'app',
  'app.showSaveDialog': 'app',
  'app.clipboard.readText': 'app',
  'app.clipboard.writeText': 'app',
  'app.clipboard.clear': 'app',
  'openInBrowser': 'app',
};

/** Every capability that exists — the trusted grant for first-party bundle plugins. */
export const ALL_CAPABILITIES: Capability[] = [
  'render',
  'models.read',
  'util',
  'crypto',
  'network',
  'storage',
  'fs-read',
  'credentials',
  'app',
];

/**
 * The capability floor every template-tag plugin receives with no manifest: recursive render,
 * read-only model access, pure util helpers, and (sync) crypto. Notably NOT network / storage /
 * fs / credentials / app — those must be declared. `util` (nodeOS/decode/encode) is baseline because
 * the same information is already freely available through the built-in `os`/`base64` tags.
 */
export const TEMPLATE_TAG_BASELINE_CAPABILITIES: Capability[] = ['render', 'models.read', 'util', 'crypto'];

/**
 * Resolve the capability set a template-tag plugin gets: the baseline floor plus whatever it
 * declared in `insomnia.permissions.capabilities` (unknown names are ignored — they map to no
 * bridge path). Profile-ceiling intersection is added in P1.
 */
export const resolveTemplateTagCapabilities = (declaredCapabilities: string[] = []): string[] => {
  const resolved: string[] = [...TEMPLATE_TAG_BASELINE_CAPABILITIES];
  for (const name of declaredCapabilities) {
    if (!resolved.includes(name as Capability)) {
      resolved.push(name);
    }
  }
  return resolved;
};

/**
 * Wrap a `pluginToMainAPI`-shaped handler map so each path rejects unless its capability is granted.
 * This is the host-side gate (defense at the bridge); C2 additionally omits ungranted branches from
 * the in-sandbox `context` so the API surface itself reflects the grant. A path with no capability
 * mapping fails closed — it can never be reached without an explicit entry in
 * `BRIDGE_PATH_CAPABILITIES`.
 */
export const filterByCapabilities = (
  handlers: Record<string, (body: any) => Promise<unknown>>,
  granted: string[],
): Record<string, (body: any) => Promise<unknown>> => {
  const grantedSet = new Set(granted);
  const filtered: Record<string, (body: any) => Promise<unknown>> = {};
  for (const [path, handler] of Object.entries(handlers)) {
    const capability = BRIDGE_PATH_CAPABILITIES[path];
    filtered[path] = async (body: any) => {
      if (capability === undefined) {
        throw new Error(`Bridge path "${path}" has no capability mapping — refusing to call it`);
      }
      if (!grantedSet.has(capability)) {
        throw new Error(`Capability '${capability}' not granted — add it to insomnia.permissions.capabilities`);
      }
      return handler(body);
    };
  }
  return filtered;
};
