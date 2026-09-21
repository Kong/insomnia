import fs from 'node:fs';
import path from 'node:path';

import { models } from 'insomnia-data';
import YAML from 'yaml';

import type { Database, DbAdapter } from '../types';
import { emptyDb } from '../types';

const gitAdapter: DbAdapter = async (dir, filterTypes) => {
  // Confirm if model directories exist
  if (!dir) {
    return null;
  }
  const insomniaFolder = path.join(dir, '.insomnia');
  let files = null;
  try {
    files = await fs.promises.readdir(insomniaFolder);
  } catch {
    if (files?.length === 0) {
      console.error(`.insomnia folder found at "${insomniaFolder}"
        but no files found inside. Ensure your workingDir is correct.`);
    }
    return null;
  }

  const db = emptyDb();

  const readAndInsertDoc = async (type: keyof Database, fileName: string): Promise<void> => {
    // Get contents of each file in type dir and insert into data
    let contents = '';
    try {
      contents = await fs.promises.readFile(fileName, 'utf8');
    } catch (error) {
      console.error(`Failed to read "${fileName}"`, error);
      return;
    }
    const obj = YAML.parse(contents);

    // Document's own type must match the folder it was read from.
    if (obj?.type !== type) {
      console.error(`Ignoring "${fileName}": document type "${obj?.type}" does not match folder type "${type}"`);
      return;
    }

    (db[type] as {}[]).push(obj);
  };

  // Only ever read folders for types explicitly marked as syncable. A folder
  // named after a non-syncable/global-singleton type (e.g. Settings) is skipped.
  const requestedTypes = filterTypes?.length ? filterTypes : (Object.keys(db) as (keyof Database)[]);
  const types = requestedTypes.filter(t => models.getModel(t)?.canSync);
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
        files.map(file => readAndInsertDoc(t, path.join(dir, '.insomnia', t, file))),
      );
    }),
  );
  return db;
};

export default gitAdapter;
