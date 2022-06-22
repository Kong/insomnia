import { app, ipcMain } from 'electron';
import { writeFile } from 'fs/promises';

import type { CurlRequest } from '../../network/libcurl-promise';
import { cancelCurlRequest, curlRequest } from '../../network/libcurl-promise';
import { authorizeUserInWindow } from '../../network/o-auth-2/misc';
import installPlugin from '../install-plugin';

export interface MainIPC {
  restart: () => void;
  authorizeUserInWindow: (options: Parameters<typeof authorizeUserInWindow>[0]) => Promise<string>;
  setMenuBarVisibility: (visible: boolean) => void;
  installPlugin: typeof installPlugin;
  writeFile: (options: {path: string; content: string}) => Promise<string>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: CurlRequest;
}
export function init() {
  ipcMain.handle('authorizeUserInWindow', (_, options: Parameters<typeof authorizeUserInWindow>[0]) => {
    const { url, urlSuccessRegex, urlFailureRegex, sessionId } = options;
    return authorizeUserInWindow({ url, urlSuccessRegex, urlFailureRegex, sessionId });
  });

  ipcMain.handle('writeFile', async (_, options) => {
    try {
      await writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
    }
  });

  ipcMain.handle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMain.on('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMain.handle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });
  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });
}
