import { ipcRenderer } from 'electron';
import type { IDatabase } from 'insomnia-data';

// Routes all database calls to the main process via the 'database.invoke' IPC handler
// that mainDatabase registers on startup.  The plugin window must not open a second
// NeDB connection to the same files, so this proxy is the correct approach.
export const pluginWindowDatabase: IDatabase = new Proxy({} as IDatabase, {
  get(_target, fnName) {
    if (typeof fnName === 'symbol') {
      return;
    }
    if (fnName === 'init') {
      // Main process already initialised the database.
      return async () => {};
    }
    if (fnName === 'flushChanges') {
      // The plugin window never needs to broadcast db.changes to other windows.
      return async () => ({ changes: [], deletedIds: [] });
    }
    return (...args: unknown[]) => ipcRenderer.invoke('database.invoke', fnName, ...args);
  },
});
