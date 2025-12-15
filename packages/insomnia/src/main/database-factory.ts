import fsPath from 'node:path';

import electron from 'electron';
import { types } from 'insomnia/src/models';
import type { DatabaseBuckets } from 'insomnia/src/models/db';
import type { DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

export function databaseFactory<T extends DBItem>(): DatabaseBuckets {
  const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');

  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    const filename = fsPath.join(dbPath, `insomnia.${bucketName}.db`);
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new NeDBClient<T>({ filename });
  });

  // Remove existing handler before registering to avoid duplicates
  electron.ipcMain.removeHandler('database.invoke');
  
  // Register a single IPC handler for all database operations
  electron.ipcMain.handle('database.invoke', async (_event, fnName: string, type: string, ...args: any[]) => {
    // @ts-expect-error -- mapping unsoundness
    return await databaseBuckets[type][fnName](...args);
  });

  return databaseBuckets;
}
