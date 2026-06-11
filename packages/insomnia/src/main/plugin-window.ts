import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

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


// Registered once so that persistent `ipcMain.on` handlers don't accumulate across window recreations.
let ipcListenersRegistered = false;

function ensureIpcListeners() {
  if (ipcListenersRegistered) {
    return;
  }
  ipcListenersRegistered = true;

  ipcMain.on('plugins.windowReady', event => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    windowReady = true;
    const startedAt = bridgeMetrics.lastStartupAt;
    const startupMs = startedAt ? Date.now() - startedAt : 0;
    bridgeMetrics.windowStartupMsLast = startupMs;
    console.log(`[plugin-bridge] window_ready startup_ms=${startupMs}`);
  });

  ipcMain.on('plugins.uiAlert', (event, options: Record<string, unknown>) => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    getMainWindow()?.webContents.send('plugins.uiAlert', options);
  });

  ipcMain.on('plugins.uiDialog', (event, options: Record<string, unknown>) => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    getMainWindow()?.webContents.send('plugins.uiDialog', options);
  });

  ipcMain.handle('plugins.uiPrompt', async (event, options: Record<string, unknown>) => {
    if (event.sender !== pluginWindow?.webContents) {
      return null;
    }
    return requestPromptFromRenderer(options as { title: string; label?: string; defaultValue?: string });
  });

  ipcMain.on(
    'plugins.invokeResult',
    (event, { id, result, error }: { id: string; result?: unknown; error?: string }) => {
      if (event.sender !== pluginWindow?.webContents) {
        return;
      }
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
  ipcMain.handle('plugins.getThemes', () => invokeInPluginWindow('getThemes'));
  ipcMain.handle('plugins.getPlugins', () => invokeInPluginWindow('getPlugins'));
  ipcMain.handle('plugins.getActivePlugins', () => invokeInPluginWindow('getActivePlugins'));
  ipcMain.handle('plugins.reloadPlugins', async () => {
    cachedHasRequestHooks = null;
    cachedHasResponseHooks = null;
    await invokeInPluginWindow('reloadPlugins');
  });
  ipcMain.handle('plugins.getRequestActions', () => invokeInPluginWindow('getRequestActions'));
  ipcMain.handle('plugins.getRequestGroupActions', () => invokeInPluginWindow('getRequestGroupActions'));
  ipcMain.handle('plugins.getWorkspaceActions', () => invokeInPluginWindow('getWorkspaceActions'));
  ipcMain.handle('plugins.getDocumentActions', () => invokeInPluginWindow('getDocumentActions'));
  ipcMain.handle('plugins.executeAction', (_event, args) => invokeInPluginWindow('executeAction', args));
  ipcMain.handle('plugins.getTemplateTags', () => invokeInPluginWindow('getTemplateTags'));
  ipcMain.handle('plugins.runTemplateTagAction', (_event, args) => invokeInPluginWindow('runTemplateTagAction', args));
  ipcMain.handle('plugins.getBundlePlugins', () => invokeInPluginWindow('getBundlePlugins'));
  ipcMain.handle('plugins.executePluginMainAction', (_event, args) =>
    invokeInPluginWindow('executePluginMainAction', args),
  );
  ipcMain.handle('plugins.hasRequestHooks', async () => {
    if (cachedHasRequestHooks === null) {
      cachedHasRequestHooks = (await invokeInPluginWindow('hasRequestHooks')) as boolean;
    }
    return cachedHasRequestHooks;
  });
  ipcMain.handle('plugins.hasResponseHooks', async () => {
    if (cachedHasResponseHooks === null) {
      cachedHasResponseHooks = (await invokeInPluginWindow('hasResponseHooks')) as boolean;
    }
    return cachedHasResponseHooks;
  });
  ipcMain.handle('plugins.applyRequestHooks', (_event, args) => invokeInPluginWindow('applyRequestHooks', args));
  ipcMain.handle('plugins.applyResponseHooks', (_event, args) => invokeInPluginWindow('applyResponseHooks', args));
  ipcMain.handle('plugins.getBridgeMetrics', () => getBridgeMetricsSnapshot());
}

export function getAppUserDataPath() {
  return app.getPath('userData');
}
