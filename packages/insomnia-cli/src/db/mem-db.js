// @flow
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { ModelEnum } from './types';

type DB = {|
  [type: ModelEnum]: Array<Object>,
  _empty: ?boolean,
|};

const db: DB = {
  _empty: true,
};

export function init(forceReset: boolean = false) {
  if (forceReset) {
    for (const attr of Object.keys(db)) {
      if (attr === '_empty') {
        continue;
      }

      delete db[attr];
    }
  }

  for (const type of ['ApiSpec', 'Workspace', 'Request', 'RequestGroup', 'Environment']) {
    if (db[type]) {
      continue;
    }

    db[type] = [];
  }

  delete db._empty;
}

export async function seedGitDataDir(dir?: string): Promise<void> {
  if (db._empty) return _dbNotInitialized();

  const insomniaDir = path.normalize(path.join(dir || '.', '.insomnia'));

  if (!fs.existsSync(insomniaDir)) {
    // TODO: control logging with verbose flag
    // console.log(`Directory not found: ${insomniaDir}`);
    return;
  }

  const readAndInsertDoc = async (fileName: string): Promise<void> => {
    // Get contents of each file in type dir and insert into db
    const contents = await fs.promises.readFile(fileName);
    const obj = YAML.parse(contents.toString());

    db[obj.type].push(obj);
  };

  await Promise.all(
    Object.keys(db).map(async type => {
      // Get all files in type dir
      const typeDir = path.join(insomniaDir, type);
      if (!fs.existsSync(typeDir)) {
        return;
      }

      const files = await fs.promises.readdir(typeDir);
      return Promise.all(
        // Insert each file from each type
        files.map(file => readAndInsertDoc(path.join(insomniaDir, type, file))),
      );
    }),
  );
}

async function _dbNotInitialized<T>(): T {
  throw new Error('Db has not been initialized.');
}

export function getWhere<T>(type: ModelEnum, query: (value: T) => boolean): T | void {
  if (db._empty) return _dbNotInitialized();

  return db[type].find(query);
}

export function all<T>(type: ModelEnum): Array<T> {
  if (db._empty) return _dbNotInitialized();

  return db[type];
}
