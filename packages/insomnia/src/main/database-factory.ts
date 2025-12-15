import fsPath from 'node:path';

import electron from 'electron';
import { types } from 'insomnia/src/models';
import type { DatabaseBuckets } from 'insomnia/src/models/db';
import type { DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

let latestListener: Parameters<typeof electron.ipcMain.on>[1] | null = null;

export function databaseFactory<T extends DBItem>(): DatabaseBuckets {
  const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');

  const handler: Parameters<typeof electron.ipcMain.on>[1] = async (e, fnName, replyChannel, type, ...args) => {
    try {
      // @ts-expect-error -- mapping unsoundness
      const result = await databaseBuckets[type][fnName](...args);
      e.sender.send(replyChannel, null, result);
    } catch (err) {
      e.sender.send(replyChannel, {
        message: err.message,
        stack: err.stack,
      });
    }
  };
  electron.ipcMain.on('db.fn.new', handler);
  if (latestListener) {
    electron.ipcMain.off('db.fn.new', latestListener);
  }
  latestListener = handler;

  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    const filename = fsPath.join(dbPath, `insomnia.${bucketName}.db`);
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new NeDBClient<T>({ filename });
  });

  return databaseBuckets;
}
