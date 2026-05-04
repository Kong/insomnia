import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

let pluginWindow: BrowserWindow | null = null;
let windowReady = false;
const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// Registered once so that persistent `ipcMain.on` handlers don't accumulate across window recreations.
let ipcListenersRegistered = false;

function ensureIpcListeners() {
  if (ipcListenersRegistered) {
    return;
  }
  ipcListenersRegistered = true;

  ipcMain.on('plugin-window-ready', event => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    windowReady = true;
    console.log('[main] plugin window is ready');
  });

  ipcMain.on('plugin-invoke-result', (event, { id, result, error }: { id: string; result?: unknown; error?: string }) => {
    if (event.sender !== pluginWindow?.webContents) {
      return;
    }
    const pending = pendingRequests.get(id);
    if (!pending) {
      return;
    }
    pendingRequests.delete(id);
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  });
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

  const pluginWindowPath = path.resolve(__dirname, 'plugin-window.html');
  pluginWindow.loadFile(pluginWindowPath);
  console.log(`[main] Loading plugin window from ${pluginWindowPath}`);
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

    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`[plugin-window] timeout invoking ${method}`));
      }
    }, 30_000);

    pendingRequests.set(id, {
      resolve: v => {
        clearTimeout(timeout);
        resolve(v);
      },
      reject: e => {
        clearTimeout(timeout);
        reject(e);
      },
    });

    pluginWindow!.webContents.send('plugin-invoke', { id, method, args });
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
    await invokeInPluginWindow('reloadPlugins');
  });
  ipcMain.handle('plugins.getRequestActions', () => invokeInPluginWindow('getRequestActions'));
  ipcMain.handle('plugins.getRequestGroupActions', () => invokeInPluginWindow('getRequestGroupActions'));
  ipcMain.handle('plugins.getWorkspaceActions', () => invokeInPluginWindow('getWorkspaceActions'));
  ipcMain.handle('plugins.getDocumentActions', () => invokeInPluginWindow('getDocumentActions'));
}

export function getAppUserDataPath() {
  return app.getPath('userData');
}
