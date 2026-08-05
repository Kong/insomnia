import { stat } from 'node:fs/promises';
import path from 'node:path';

import NeDB from '@seald-io/nedb';
import type { BaseModel } from 'insomnia-data';
import { database, initDatabase } from 'insomnia-data';
import { createNedbDatabase } from 'insomnia-data/node';

import type { Database, DbAdapter } from '../types';
import { emptyDb } from '../types';

/** Reads a single on-disk NeDB collection file as-is, without touching the file (no repair/migration). */
const readNedbFile = (filePath: string): Promise<BaseModel[]> =>
  new Promise((resolve, reject) => {
    const collection = new NeDB({
      autoload: true,
      filename: filePath,
      corruptAlertThreshold: 0.9,
    });
    collection.find({}, (err: Error, docs: BaseModel[]) => {
      if (err) {
        return reject(err);
      }

      resolve(docs);
    });
  });

const neDbAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if db files exist
  try {
    await stat(path.join(dir, 'insomnia.Workspace.db'));
  } catch {
    return null;
  }

  const db = emptyDb();
  const types = filterTypes?.length ? filterTypes : (Object.keys(db) as (keyof Database)[]);

  const docsByType = await Promise.all(types.map(t => readNedbFile(path.join(dir, `insomnia.${t}.db`))));
  const allDocs = docsByType.flat();

  // Load the raw docs into an in-memory database so they go through insomnia-data's real model
  // init/migration logic, the same way the desktop app and CLI network path already do.
  await initDatabase(createNedbDatabase(), { inMemoryOnly: true }, true);
  await database.batchModifyDocs({ upsert: allDocs });

  await Promise.all(
    types.map(async t => {
      (db[t] as BaseModel[]).push(...(await database.find(t)));
    }),
  );

  return db;
};

export default neDbAdapter;
