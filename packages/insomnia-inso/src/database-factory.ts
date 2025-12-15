import fsPath from 'node:path';

import { types } from 'insomnia/src/models';
import type { DatabaseBuckets } from 'insomnia/src/models/db';
import { NeDBClient } from 'insomnia-storage/node';

export const genDatabaseFactory = (dbPath?: string) => (): DatabaseBuckets => {
  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    const filename = dbPath ? fsPath.join(dbPath, `insomnia.${bucketName}.db`) : undefined;
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new NeDBClient<T>(filename ? { filename } : { inMemoryOnly: true });
  });

  return databaseBuckets;
};
