import { BrowserWindow, shell } from 'electron';

import { isDevelopment } from '~/common/constants';

import { buildPreviewHtml } from './html-preview-content';
import { getMainWindow } from './window-utils';

/**
 * Isolated HTML response preview surface.
 *
 * The visual preview of an HTML response opens in a dedicated, hardened
 * {@link BrowserWindow} rather than inline in the response pane. A separate
 * top-level window means the preview:
 *   - is a **top-level** browsing context, so pages that branch on
 *     `window.top === window.self` (frame-busters, SPA routers, auth/analytics
 *     guards) render the same way they do in a real browser;
 *   - runs **out-of-process**, so a runaway/looping preview script cannot
 *     freeze the Insomnia renderer;
 *   - does not overlay (and cannot be overlaid by) the app's own DOM — unlike a
 *     native view painted over the response pane, there is nothing to keep
 *     positioned and nothing to occlude dropdowns/modals.
 *
 * The window is hardened: no Node integration, context-isolated, sandboxed, no
 * preload, no `webviewTag`, and it cannot open windows or navigate away from
 * the loaded response (external links open in the user's browser).
 */

let previewWindow: BrowserWindow | null = null;
// webPreferences (incl. `javascript`) are immutable per window, so the window
// is recreated whenever the "Disable JS in HTML preview" toggle changes.
let currentJsEnabled: boolean | null = null;

const openExternally = (targetUrl: string) => {
  try {
    const { protocol } = new URL(targetUrl);
    if (protocol === 'http:' || protocol === 'https:') {
      void shell.openExternal(targetUrl);
    }
  } catch {
    // ignore malformed URLs
  }
};

const createPreviewWindow = (jsEnabled: boolean): BrowserWindow => {
  const window = new BrowserWindow({
    parent: getMainWindow() ?? undefined,
    show: false,
    width: 900,
    height: 700,
    backgroundColor: '#ffffff',
    title: 'HTML response preview',
    webPreferences: {
      // Hardened: previewed HTML is untrusted response content.
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      javascript: jsEnabled,
      spellcheck: false,
      devTools: isDevelopment(),
    },
  });

  window.setMenuBarVisibility(false);

  // The preview must never spawn Electron windows, attach webviews, or navigate
  // away from the loaded response. New-window requests (target=_blank /
  // window.open) and in-page navigations (link clicks, location changes) open
  // in the user's browser instead. loadURL() does not emit will-navigate, so
  // the initial data: render is unaffected.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault();
    openExternally(navigationUrl);
  });

  window.on('closed', () => {
    previewWindow = null;
    currentJsEnabled = null;
  });

  return window;
};

export const openHtmlPreview = (options: { body: string; url: string; disableJs: boolean }) => {
  const jsEnabled = !options.disableJs;

  if (!previewWindow || previewWindow.isDestroyed() || currentJsEnabled !== jsEnabled) {
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.destroy();
    }
    previewWindow = createPreviewWindow(jsEnabled);
    currentJsEnabled = jsEnabled;
  }

  const html = buildPreviewHtml(options.body, options.url);
  previewWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  previewWindow.show();
  previewWindow.focus();
};
