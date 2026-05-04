import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

let pluginWindow: BrowserWindow | null = null;
let windowReady = false;
const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

let requestCounter = 0;

export function getPluginWindow() {
  return pluginWindow;
}

export function createPluginWindow() {
  if (pluginWindow && !pluginWindow.isDestroyed()) {
    return;
  }

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

  ipcMain.removeAllListeners('plugin-window-ready');
  ipcMain.once('plugin-window-ready', () => {
    windowReady = true;
    console.log('[main] plugin window is ready');
  });

  ipcMain.removeAllListeners('plugin-invoke-result');
  ipcMain.on('plugin-invoke-result', (_event, { id, result, error }: { id: string; result?: unknown; error?: string }) => {
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

  const pluginWindowPath = path.resolve(__dirname, 'plugin-window.html');
  pluginWindow.loadFile(pluginWindowPath);
  console.log(`[main] Loading plugin window from ${pluginWindowPath}`);
}

function waitForReady(): Promise<void> {
  if (windowReady) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (windowReady) {
        clearInterval(check);
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
    const id = `${++requestCounter}-${Date.now()}`;

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
