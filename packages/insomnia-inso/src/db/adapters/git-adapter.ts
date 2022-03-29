import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

import { UNKNOWN } from '../../types';
import type { Database, DbAdapter } from '../index';
import { emptyDb } from '../index';

const gitAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if model directories exist
  dir = path.join(dir, '.insomnia');
  if (!fs.existsSync(path.join(dir, 'Workspace'))) {
    return null;
  }

  const db = emptyDb();

  const readAndInsertDoc = async (
    type: keyof Database,
    fileName: string,
  ): Promise<void> => {
    // Get contents of each file in type dir and insert into data
    const contents = await fs.promises.readFile(fileName);
    const obj = YAML.parse(contents.toString());
    (db[type] as UNKNOWN[]).push(obj);
  };

  const types = filterTypes?.length ? filterTypes : Object.keys(db) as (keyof Database)[];
  await Promise.all(
    types.map(async t => {
      // Get all files in type dir
      const typeDir = path.join(dir, t);

      if (!fs.existsSync(typeDir)) {
        return;
      }

      const files = await fs.promises.readdir(typeDir);
      return Promise.all(
        // Insert each file from each type
        files.map(file =>
          readAndInsertDoc(t, path.join(dir, t, file)),
        ),
      );
    }),
  );
  return db;
};

export default gitAdapter;
