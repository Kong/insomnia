import { stat } from 'node:fs/promises';
import path from 'node:path';

import { database } from 'insomnia/src/common/database';

import { configureModel } from '~/models/db';

import type { Database, DbAdapter } from '../index';
import { emptyDb } from '../index';
import { genDatabaseFactory } from './database-factory';

const neDbAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if db files exist
  try {
    await stat(path.join(dir, 'insomnia.Workspace.db'));
  } catch {
    return null;
  }

  const db = emptyDb();

  const databaseFactory = genDatabaseFactory(dir);
  configureModel({ databaseFactory });
  await database.init();

  const types = filterTypes?.length ? filterTypes : (Object.keys(db) as (keyof Database)[]);
  const promises = types.map(async t => {
    const docs = await database.find(t);
    (db[t] as {}[]).push(...docs);
  });
  await Promise.all(promises);
  return db;
};

export default neDbAdapter;
