import { type BrowserWindow } from 'electron';

// Holds the application's live BrowserWindow handles so modules that only need to read the main
// window (`plugin-window`, `prompt-bridge`, `templating-db-auth`) don't have to import
// `window-utils` — which, combined with `window-utils` driving the plugin window from this module,
// would otherwise form a circular import.
export const browserWindows = new Map<'Insomnia' | 'HiddenBrowserWindow', BrowserWindow>();

export function getMainWindow(): BrowserWindow | null {
  return browserWindows.get('Insomnia') ?? null;
}
