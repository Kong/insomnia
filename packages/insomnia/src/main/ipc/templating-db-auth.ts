import type { IpcMainInvokeEvent } from 'electron';

import { getPluginWindow } from '../plugin-window';
import { getOrCreateTemplatingDbAuthToken } from '../templating-worker-database-auth';
import { getMainWindow } from '../window-utils';
import { ipcMainHandle } from './electron';

// Only hands the templating db auth token to the main app window or the hidden plugin window.
export function registerTemplatingDbAuthIpcHandler() {
  ipcMainHandle('templatingDb.getAuthToken', (event: IpcMainInvokeEvent) => {
    const isMainWindow = event.sender === getMainWindow()?.webContents;
    const isPluginWindow = event.sender === getPluginWindow()?.webContents;
    if (!isMainWindow && !isPluginWindow) {
      throw new Error(
        '[templating-db-auth] rejected templatingDb.getAuthToken: sender is neither the main app window nor the plugin window',
      );
    }
    return getOrCreateTemplatingDbAuthToken();
  });
}
