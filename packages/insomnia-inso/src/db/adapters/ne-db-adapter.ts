import fs from 'fs';
import NeDB from 'nedb';
import path from 'path';

import { UNKNOWN, UNKNOWN_OBJ } from '../../types';
import { Database, DbAdapter, emptyDb } from '../index';
import type { BaseModel } from '../models/types';

const neDbAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if db files exist
  if (!fs.existsSync(path.join(dir, 'insomnia.Workspace.db'))) {
    return null;
  }

  const db = emptyDb();
  const types = filterTypes?.length ? filterTypes : Object.keys(db) as (keyof Database)[];
  const promises = types.map(t =>
    new Promise((resolve, reject) => {
      const filePath = path.join(dir, `insomnia.${t}.db`);
      const collection = new NeDB({
        autoload: true,
        filename: filePath,
        corruptAlertThreshold: 0.9,
      });
      collection.find({}, (err: UNKNOWN, docs: BaseModel[]) => {
        if (err) {
          return reject(err);
        }

        (db[t] as UNKNOWN_OBJ[]).push(...docs);
        resolve(null);
      });
    }),
  );
  await Promise.all(promises);
  return db;
};

export default neDbAdapter;
