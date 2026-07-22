import type { IpcMainInvokeEvent } from 'electron';

import { getPluginWindow } from '../plugin-window';
import { getOrCreateTemplatingDbAuthToken } from '../templating-worker-database-auth';
import { getMainWindow } from '../window-utils';
import { ipcMainHandle } from './electron';

// The templating-db auth token (F1) is only ever handed out to the two windows that legitimately
// call the `insomnia-templating-worker-database://` protocol: the main app window and the hidden
// plugin window. Any other sender (a compromised/forged renderer without the real window's
// `webContents`) is rejected, mirroring the sender check `plugin-window.ts` uses for `plugins.*`.
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
