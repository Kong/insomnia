// @flow
import path from 'path';
import NeDB from 'nedb';
import type { BaseModel } from '../models/types';
import type { DbAdapter } from '../index';
import { emptyDb } from '../index';
import fs from 'fs';

const neDbAdapter: DbAdapter = async (dir, filterTypes) => {
  // Sanity check - do db files exist?
  if (!fs.existsSync(path.join(dir, 'insomnia.Workspace.db'))) {
    return null;
  }

  const db = emptyDb();

  const types = filterTypes?.length ? filterTypes : Object.keys(db);

  const promises = types.map(
    type =>
      new Promise((resolve, reject) => {
        const filePath = path.join(dir, `insomnia.${type}.db`);
        const collection = new NeDB({
          autoload: true,
          filename: filePath,
          corruptAlertThreshold: 0.9,
        });
        collection.find({}, (err, docs: Array<BaseModel>) => {
          if (err) {
            return reject(err);
          }

          (db[type]: Array<Object>).push(...docs);
          resolve();
        });
      }),
  );

  await Promise.all(promises);

  return db;
};

export default neDbAdapter;
