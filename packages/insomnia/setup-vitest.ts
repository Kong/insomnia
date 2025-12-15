import { NeDBClient } from 'insomnia-storage/node';
import { vi } from 'vitest';

import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { database as db } from './src/common/database';
import { types } from './src/models';
import { v4Mock } from './src/models/__mocks__/uuid';
import { configureModel, type DatabaseBuckets } from './src/models/db';

vi.mock('electron', () => ({ default: electronMock }));
export function databaseFactory(): DatabaseBuckets {
  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new NeDBClient({ inMemoryOnly: true });
  });

  return databaseBuckets;
}

configureModel({ databaseFactory });
await db.init(false, true);

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
vi.mock('@getinsomnia/node-libcurl', () => nodeLibcurlMock);

vi.mock('isomorphic-git', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...Object.assign({}, actual),
    push: vi.fn(),
    clone: vi.fn(),
  };
});
