import type { Database, DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';
import { vi } from 'vitest';

import { configureModel } from '~/models/db';

import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { database as db } from './src/common/database';
import { v4Mock } from './src/models/__mocks__/uuid';

vi.mock('electron', () => ({ default: electronMock }));
const databaseMap = new Map<string, Database<DBItem>>();
export function databaseFactory<T extends DBItem>(type: string): Database<T> {
  if (databaseMap.has(type)) {
    return databaseMap.get(type) as Database<T>;
  }

  const db = new NeDBClient<T>({});
  databaseMap.set(type, db);
  return db;
}

configureModel({ databaseFactory });
await db.init({ inMemoryOnly: true }, true);

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
