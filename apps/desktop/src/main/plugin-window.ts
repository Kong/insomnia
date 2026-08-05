import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';

import { requestPromptFromRenderer } from './prompt-bridge';
import { getMainWindow } from './window-utils';

let pluginWindow: BrowserWindow | null = null;
let windowReady = false;
const pendingRequests = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string; startedAt: number }
>();

let cachedHasRequestHooks: boolean | null = null;
let cachedHasResponseHooks: boolean | null = null;

// Bridge observability counters.  Kept in-memory and exposed via the
// `plugins.getBridgeMetrics` IPC handler so devs / smoke tests / support
// dumps can read the live state without scraping logs.
interface BridgeMethodStats {
  ok: number;
  error: number;
  timeout: number;
  totalDurationMs: number;
  maxDurationMs: number;
}
const bridgeMetrics = {
  windowStartups: 0,
  windowCrashes: 0,
  windowStartupMsLast: 0 as number | null,
  // wall-clock time of the most recent createPluginWindow() call
  lastStartupAt: 0 as number | null,
  perMethod: new Map<string, BridgeMethodStats>(),
};

function recordInvocation(method: string, outcome: 'ok' | 'error' | 'timeout', durationMs: number) {
  let stats = bridgeMetrics.perMethod.get(method);
  if (!stats) {
    stats = { ok: 0, error: 0, timeout: 0, totalDurationMs: 0, maxDurationMs: 0 };
    bridgeMetrics.perMethod.set(method, stats);
  }
  stats[outcome] += 1;
  stats.totalDurationMs += durationMs;
  if (durationMs > stats.maxDurationMs) {
    stats.maxDurationMs = durationMs;
  }
  // Single structured log line per invocation; cheap to grep, easy to ship to analytics later.
  console.log(`[plugin-bridge] invoke method=${method} outcome=${outcome} duration_ms=${durationMs}`);
}

export function getBridgeMetricsSnapshot() {
  const perMethod: Record<string, BridgeMethodStats & { avgDurationMs: number }> = {};
  for (const [method, stats] of bridgeMetrics.perMethod) {
    const calls = stats.ok + stats.error + stats.timeout;
    perMethod[method] = {
      ...stats,
      avgDurationMs: calls > 0 ? Math.round(stats.totalDurationMs / calls) : 0,
    };
  }
  return {
    windowStartups: bridgeMetrics.windowStartups,
    windowCrashes: bridgeMetrics.windowCrashes,
    windowStartupMsLast: bridgeMetrics.windowStartupMsLast,
    windowReady,
    pendingInvocations: pendingRequests.size,
    perMethod,
  };
}

// --- Sender-checked IPC registration wrappers -------------------------------------------
//
// Every `ipcMain.handle`/`ipcMain.on` call in this file must go through one of the three
// wrappers below instead of the raw `ipcMain` API, so each channel enforces which window is
// allowed to be its caller. `plugin-window-ipc-authorization.test.ts` fails the build if a bare
// `ipcMain` call is added to this file outside these three function bodies.

/**
 * Registers a channel that dispatches a plugin operation into the hidden plugin window
 * (`getThemes`, `applyRequestHooks`, `executeAction`, etc.), forwarding caller-supplied data to
 * `invokeInPluginWindow`. Restricted to the real main app window; any other sender gets a
 * rejected promise instead of a result.
 */
function handleFromMainWindow<Args = unknown, R = unknown>(
  channel: string,
  handler: (args: Args) => R | Promise<R>,
): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, args: Args) => {
    if (event.sender !== getMainWindow()?.webContents) {
      throw new Error(`[plugin-bridge] rejected ${channel}: sender is not the main app window`);
    }
    return handler(args);
  });
}

/**
 * Registers a fire-and-forget callback that the hidden plugin window sends back to the host
 * (a UI callback, an invoke result). Restricted to the plugin window itself; any other sender
 * is silently ignored, matching how these "reverse direction" messages already behaved.
 */
function onFromPluginWindow<Args = unknown>(channel: string, handler: (args: Args) => void): void {
  ipcMain.on(channel, (event: IpcMainEvent, args: Args) => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    handler(args);
  });
}

/** Like {@link onFromPluginWindow}, but for the one plugin-window callback that replies (`plugins.uiPrompt`). */
function handleFromPluginWindow<Args = unknown, R = unknown>(
  channel: string,
  handler: (args: Args) => R | Promise<R>,
): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, args: Args) => {
    if (event.sender !== pluginWindow?.webContents) {
      return null;
    }
    return handler(args);
  });
}

// Registered once so that persistent `ipcMain.on` handlers don't accumulate across window recreations.
let ipcListenersRegistered = false;

function ensureIpcListeners() {
  if (ipcListenersRegistered) {
    return;
  }
  ipcListenersRegistered = true;

  onFromPluginWindow<void>('plugins.windowReady', () => {
    windowReady = true;
    const startedAt = bridgeMetrics.lastStartupAt;
    const startupMs = startedAt ? Date.now() - startedAt : 0;
    bridgeMetrics.windowStartupMsLast = startupMs;
    console.log(`[plugin-bridge] window_ready startup_ms=${startupMs}`);
  });

  onFromPluginWindow<Record<string, unknown>>('plugins.uiAlert', options => {
    getMainWindow()?.webContents.send('plugins.uiAlert', options);
  });

  onFromPluginWindow<Record<string, unknown>>('plugins.uiDialog', options => {
    getMainWindow()?.webContents.send('plugins.uiDialog', options);
  });

  handleFromPluginWindow<{ title: string; label?: string; defaultValue?: string }>('plugins.uiPrompt', options =>
    requestPromptFromRenderer(options),
  );

  onFromPluginWindow<{ id: string; result?: unknown; error?: string }>(
    'plugins.invokeResult',
    ({ id, result, error }) => {
      const pending = pendingRequests.get(id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(id);
      const duration = Date.now() - pending.startedAt;
      if (error) {
        recordInvocation(pending.method, 'error', duration);
        pending.reject(new Error(error));
      } else {
        recordInvocation(pending.method, 'ok', duration);
        pending.resolve(result);
      }
    },
  );
}

export function getPluginWindow() {
  return pluginWindow;
}

export function createPluginWindow() {
  if (pluginWindow && !pluginWindow.isDestroyed()) {
    return;
  }

  ensureIpcListeners();

  pluginWindow = new BrowserWindow({
    show: false,
    title: 'PluginWindow',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'entry.plugin-window-preload.min.js'),
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  pluginWindow.on('closed', () => {
    pluginWindow = null;
    windowReady = false;
    for (const [id, { reject }] of pendingRequests) {
      pendingRequests.delete(id);
      reject(new Error('[plugin-window] window closed'));
    }
  });

  pluginWindow.webContents.on('render-process-gone', (_event, details) => {
    bridgeMetrics.windowCrashes += 1;
    console.log(`[plugin-bridge] window_crash reason=${details.reason} exit_code=${details.exitCode}`);
  });

  bridgeMetrics.windowStartups += 1;
  bridgeMetrics.lastStartupAt = Date.now();
  const pluginWindowPath = path.resolve(__dirname, 'plugin-window.html');
  pluginWindow.loadFile(pluginWindowPath);
  console.log(`[plugin-bridge] window_loading path=${pluginWindowPath} startups_total=${bridgeMetrics.windowStartups}`);
}

function waitForReady(timeoutMs = 10_000): Promise<void> {
  if (windowReady) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onFailLoad = () => {
      clearInterval(check);
      clearTimeout(timer);
      reject(new Error('[plugin-window] failed to load'));
    };

    pluginWindow?.webContents.once('did-fail-load', onFailLoad);

    const timer = setTimeout(() => {
      clearInterval(check);
      pluginWindow?.webContents.off('did-fail-load', onFailLoad);
      reject(new Error('[plugin-window] timed out waiting for ready'));
    }, timeoutMs);

    const check = setInterval(() => {
      if (windowReady) {
        clearInterval(check);
        clearTimeout(timer);
        pluginWindow?.webContents.off('did-fail-load', onFailLoad);
        resolve();
      }
    }, 50);
  });
}

export async function invokeInPluginWindow(method: string, args?: unknown): Promise<unknown> {
  if (!pluginWindow || pluginWindow.isDestroyed()) {
    createPluginWindow();
  }

  await waitForReady();

  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const startedAt = Date.now();

    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        recordInvocation(method, 'timeout', Date.now() - startedAt);
        reject(new Error(`[plugin-window] timeout invoking ${method}`));
      }
    }, 30_000);

    pendingRequests.set(id, {
      method,
      startedAt,
      resolve: v => {
        clearTimeout(timeout);
        resolve(v);
      },
      reject: e => {
        clearTimeout(timeout);
        reject(e);
      },
    });

    pluginWindow!.webContents.send('plugins.invoke', { id, method, args });
  });
}

export function destroyPluginWindow() {
  pluginWindow?.destroy();
  pluginWindow = null;
  windowReady = false;
}

export function reloadPluginsInWindow() {
  if (pluginWindow && !pluginWindow.isDestroyed()) {
    pluginWindow.reload();
    windowReady = false;
  }
}

export function registerPluginIpcHandlers() {
  handleFromMainWindow('plugins.getThemes', () => invokeInPluginWindow('getThemes'));
  handleFromMainWindow('plugins.getPlugins', () => invokeInPluginWindow('getPlugins'));
  handleFromMainWindow('plugins.getActivePlugins', () => invokeInPluginWindow('getActivePlugins'));
  handleFromMainWindow('plugins.reloadPlugins', async () => {
    cachedHasRequestHooks = null;
    cachedHasResponseHooks = null;
    await invokeInPluginWindow('reloadPlugins');
  });
  handleFromMainWindow('plugins.getRequestActions', () => invokeInPluginWindow('getRequestActions'));
  handleFromMainWindow('plugins.getRequestGroupActions', () => invokeInPluginWindow('getRequestGroupActions'));
  handleFromMainWindow('plugins.getWorkspaceActions', () => invokeInPluginWindow('getWorkspaceActions'));
  handleFromMainWindow('plugins.getDocumentActions', () => invokeInPluginWindow('getDocumentActions'));
  handleFromMainWindow('plugins.executeAction', args => invokeInPluginWindow('executeAction', args));
  handleFromMainWindow('plugins.getTemplateTags', () => invokeInPluginWindow('getTemplateTags'));
  handleFromMainWindow('plugins.runTemplateTagAction', args => invokeInPluginWindow('runTemplateTagAction', args));
  handleFromMainWindow('plugins.getBundlePlugins', () => invokeInPluginWindow('getBundlePlugins'));
  handleFromMainWindow('plugins.executePluginMainAction', args => invokeInPluginWindow('executePluginMainAction', args));
  handleFromMainWindow('plugins.hasRequestHooks', async () => {
    if (cachedHasRequestHooks === null) {
      cachedHasRequestHooks = (await invokeInPluginWindow('hasRequestHooks')) as boolean;
    }
    return cachedHasRequestHooks;
  });
  handleFromMainWindow('plugins.hasResponseHooks', async () => {
    if (cachedHasResponseHooks === null) {
      cachedHasResponseHooks = (await invokeInPluginWindow('hasResponseHooks')) as boolean;
    }
    return cachedHasResponseHooks;
  });
  handleFromMainWindow('plugins.applyRequestHooks', args => invokeInPluginWindow('applyRequestHooks', args));
  handleFromMainWindow('plugins.applyResponseHooks', args => invokeInPluginWindow('applyResponseHooks', args));
  handleFromMainWindow('plugins.getBridgeMetrics', () => getBridgeMetricsSnapshot());
}

export function getAppUserDataPath() {
  return app.getPath('userData');
}
