import electron from 'electron';
import type { DataStoreOptions, IDatabase } from 'insomnia-data';
import { createNedbDatabase } from 'insomnia-data/node';

import { getLocalEncryptionKey } from './local-encryption-key';

export const mainDatabase: IDatabase = createNedbDatabase((nedbDatabase, { flushChangesImpl }) => ({
  ...nedbDatabase,
  init: async (config: DataStoreOptions = {}, forceReset = false) => {
    const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    // The safeStorage-protected local key, created on the first launch. In-memory instances never write to disk, so they
    // need no key. Resolves undefined when the key cannot be loaded or created: the database then opens without
    // encryption (degraded mode), and the next launch tries again.
    const fieldEncryptionKey = config.inMemoryOnly ? undefined : await getLocalEncryptionKey();
    await nedbDatabase.init(
      {
        dbPath,
        fieldEncryptionKey,
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
}));
