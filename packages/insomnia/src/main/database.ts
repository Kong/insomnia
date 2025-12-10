import fsPath from 'node:path';

import electron from 'electron';
import type { Database, DBItem } from 'insomnia-storage';
import { NeDBClient, SQLiteClient } from 'insomnia-storage/node';

const nedbMap = new Map<string, Database<DBItem>>();

electron.ipcMain.on('db.fn.new', async (e, fnName, replyChannel, type, ...args) => {
  try {
    const database = databaseFactory<DBItem>(type);
    // @ts-expect-error -- mapping unsoundness
    const result = await database[fnName](...args);
    e.sender.send(replyChannel, null, result);
  } catch (err) {
    e.sender.send(replyChannel, {
      message: err.message,
      stack: err.stack,
    });
  }
});

export function databaseFactory<T extends DBItem>(type: string): Database<T> {
  if (nedbMap.has(type)) {
    return nedbMap.get(type) as Database<T>;
  }

  const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');

  // const db = new NeDBClient<T>({
  //   filename: fsPath.join(dbPath, `insomnia.${type}.db`),
  // });
  const db = new SQLiteClient<T>({
    filename: fsPath.join(dbPath, `insomnia.sqlite`),
    tableName: type,
  });
  nedbMap.set(type, db);
  return db;
}
