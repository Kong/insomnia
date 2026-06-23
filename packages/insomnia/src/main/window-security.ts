/**
 * Security-critical `webPreferences` for the MAIN renderer `BrowserWindow`.
 *
 * DO NOT WEAKEN these values (e.g. `nodeIntegration: true` or `contextIsolation: false`).
 * Doing so re-exposes Node.js APIs (`require`/`Buffer`/`process`) to rendered content
 * and is a serious security regression — not a valid shortcut for getting renderer code
 * to work. Move Node logic to the main process via IPC instead.
 *
 * These values are pinned by `window-security.test.ts`, which fails CI if they change.
 * This module is intentionally free of side effects so it can be imported in a unit test.
 *
 * NOTE: this applies to the main window only. The hidden script-execution window
 * (`createHiddenBrowserWindow`) deliberately uses `nodeIntegration: true`.
 */
export const MAIN_WINDOW_SECURITY = {
  // The renderer must not have direct Node.js integration.
  nodeIntegration: false,
  // Must remain false so the nunjucks web worker sandbox has no access to Node.js APIs.
  nodeIntegrationInWorker: false,
  // Isolate the preload's world from the renderer's main world.
  contextIsolation: true,
} as const;
