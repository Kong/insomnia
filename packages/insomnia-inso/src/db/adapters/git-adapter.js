// @flow
import fs from 'fs';
import YAML from 'yaml';
import path from 'path';
import { emptyDb } from '../index';
import type { Database, DbAdapter } from '../index';

const gitAdapter: DbAdapter = async (dir, filterTypes) => {
  dir = path.join(dir, '.insomnia');

  // Sanity check - do model directories exist?
  if (!fs.existsSync(path.join(dir, 'Workspace'))) {
    return null;
  }

  const db = emptyDb();

  const readAndInsertDoc = async (type: $Keys<Database>, fileName: string): Promise<void> => {
    // Get contents of each file in type dir and insert into data
    const contents = await fs.promises.readFile(fileName);
    const obj = YAML.parse(contents.toString());

    // Make flow happy
    (db[type]: Array<any>).push(obj);
  };

  const types = filterTypes?.length ? filterTypes : Object.keys(db);

  await Promise.all(
    types.map(async type => {
      // Get all files in type dir
      const typeDir = path.join(dir, type);
      if (!fs.existsSync(typeDir)) {
        return;
      }

      const files = await fs.promises.readdir(typeDir);
      return Promise.all(
        // Insert each file from each type
        files.map(file => readAndInsertDoc(type, path.join(dir, type, file))),
      );
    }),
  );

  return db;
};

export default gitAdapter;
