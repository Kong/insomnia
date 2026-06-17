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
    const handler = handlers[path];
    if (!handler) {
      throw new Error(`No host bridge handler registered for "${path}"`);
    }
    return handler(body);
  };

/** Bridge paths whose storage is scoped per-plugin; their `pluginName` must come from the host. */
export const PLUGIN_DATA_PATHS = [
  'pluginData.hasItem',
  'pluginData.setItem',
  'pluginData.getItem',
  'pluginData.removeItem',
  'pluginData.clear',
  'pluginData.all',
] as const;

/**
 * Defense in depth for plugin storage. The in-sandbox context stamps the owning `pluginName` onto
 * every `pluginData.*` call, but that value originates inside the sandbox and so can be forged. This
 * wraps the `pluginData.*` handlers to overwrite `pluginName` with the trusted name the host knows
 * for the executing tag, regardless of what the sandbox sent — preventing one plugin from reading or
 * clearing another plugin's store. All other handlers pass through unchanged.
 */
export const scopePluginDataHandlers = (
  handlers: Record<string, (body: any) => Promise<unknown>>,
  pluginName: string,
): Record<string, (body: any) => Promise<unknown>> => {
  const scoped: Record<string, (body: any) => Promise<unknown>> = { ...handlers };
  for (const path of PLUGIN_DATA_PATHS) {
    const handler = handlers[path];
    if (handler) {
      scoped[path] = body => handler({ ...body, pluginName });
    }
  }
  return scoped;
};
