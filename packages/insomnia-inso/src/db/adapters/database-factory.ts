import fsPath from 'node:path';

import type { Database, DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

const nedbMap = new Map<string, Database<DBItem>>();

export const genDatabaseFactory =
  (dbPath: string) =>
  <T extends DBItem>(type: string): Database<T> => {
    if (nedbMap.has(type)) {
      return nedbMap.get(type) as Database<T>;
    }

    const db = new NeDBClient<T>({
      filename: fsPath.join(dbPath, `insomnia.${type}.db`),
    });
    nedbMap.set(type, db);
    return db;
  };
