import type NeDB from '@seald-io/nedb';
import electron from 'electron';

import type { IDatabase } from '~/insomnia-data';
import { flushChangesImpl, nedbDatabase } from '~/insomnia-data/node';

export const mainDatabase: IDatabase = {
  ...nedbDatabase,
  init: async (config: NeDB.DataStoreOptions = {}, forceReset = false) => {
    const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    await nedbDatabase.init(
      {
        dbPath,
        ...config,
      },
      forceReset,
    );

    // Register IPC handler for renderer process bridge calls
    electron.ipcMain.handle('database.invoke', async (_e, fnName: string, ...args: unknown[]) => {
      const fn = mainDatabase[fnName as keyof IDatabase] as (...args: unknown[]) => unknown;
      if (typeof fn !== 'function') {
        throw new TypeError(`Unknown database method: ${fnName}`);
      }
      return fn(...args);
    });
  },
  flushChanges: async function (id = 0, fake = false) {
    const changes = await flushChangesImpl(id, fake);

    if (changes) {
      const windows = electron.BrowserWindow.getAllWindows();

      for (const window of windows) {
        window.webContents.send('db.changes', changes);
      }
    }
  },
};
