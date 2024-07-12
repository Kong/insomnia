import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

import type { Database, DbAdapter } from '../index';
import { emptyDb } from '../index';

const gitAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if model directories exist
  if (!dir) {
    return null;
  }
  const workspaceFolder = path.join(dir, '.insomnia', 'Workspace');
  try {
    await fs.promises.readdir(workspaceFolder);
  } catch (error) {
  // console.error(`Failed to read "${workspaceFolder}"`, error);
    return null;
  }

  const db = emptyDb();

  const readAndInsertDoc = async (
    type: keyof Database,
    fileName: string,
  ): Promise<void> => {
    // Get contents of each file in type dir and insert into data
    let contents = '';
    try {
      contents = await fs.promises.readFile(fileName, 'utf8');
    } catch (error) {
      console.error(`Failed to read "${fileName}"`, error);
      return;
    }
    const obj = YAML.parse(contents);
    (db[type] as {}[]).push(obj);
  };

  const types = filterTypes?.length ? filterTypes : Object.keys(db) as (keyof Database)[];
  await Promise.all(
    types.map(async t => {
      // Get all files in type dir
      const typeDir = path.join(dir, '.insomnia', t);
      let files: string[] = [];
      try {
        files = await fs.promises.readdir(typeDir);
      } catch (error) {
        console.error(`Failed to read "${typeDir}"`, error);
        return;
      }
      return Promise.all(
        // Insert each file from each type
        files.map(file =>
          readAndInsertDoc(t, path.join(dir, '.insomnia', t, file)),
        ),
      );
    }),
  );
  return db;
};

export default gitAdapter;
