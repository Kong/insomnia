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
