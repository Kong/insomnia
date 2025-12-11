import fsPath from 'node:path';

import type { Database, DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

const databaseMap = new Map<string, Database<DBItem>>();

export const genDatabaseFactory =
  (dbPath: string) =>
  <T extends DBItem>(type: string): Database<T> => {
    if (databaseMap.has(type)) {
      return databaseMap.get(type) as Database<T>;
    }

    const db = new NeDBClient<T>({
      filename: fsPath.join(dbPath, `insomnia.${type}.db`),
    });
    databaseMap.set(type, db);
    return db;
  };
