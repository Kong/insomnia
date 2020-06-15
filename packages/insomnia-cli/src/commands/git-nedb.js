// @flow
import fs from 'fs';
import path from 'path';
import NeDB from 'nedb';
import YAML from 'yaml';

const db = ({
  _empty: true,
}: Object);

// TODO: Should not be hardcoded and should come from model types
export const SUPPORTED_TYPES = ['ApiSpec', 'Workspace', 'Request', 'RequestGroup', 'Environment'];

export function init(types: Array<string>, forceReset: boolean = false) {
  if (forceReset) {
    for (const attr of Object.keys(db)) {
      if (attr === '_empty') {
        continue;
      }

      delete db[attr];
    }
  }

  for (const type of types) {
    if (db[type]) {
      continue;
    }

    db[type] = new NeDB();
  }

  delete db._empty;
}

// TODO: Add db seeding functions for electron insomnia dir, insomnia export format
export async function seedGitDataDir(dir?: string): Promise<void> {
  if (db._empty) return _dbNotInitialized();

  const insomniaDir = path.normalize(path.join(dir || '.', '.insomnia'));

  if (!fs.existsSync(insomniaDir)) {
    // TODO: control logging with verbose flag
    // console.log(`Directory not found: ${insomniaDir}`);
    return;
  }

  const readAndInsertDoc = (fileName: string): Promise<void> =>
    new Promise(async (resolve, reject) => {
      // Get contents of each file in type dir and insert into db
      const contents = await fs.promises.readFile(fileName);
      const obj = YAML.parse(contents.toString());

      db[obj.type].insert(obj, (err, newDoc) => {
        if (err) {
          return reject(err);
        }
        resolve(newDoc);
      });
    });

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

async function _dbNotInitialized<T>(): Promise<T> {
  throw new Error('Db has not been initialized.');
}

// Other than empty db handling, the following functions are practically copy-paste from database.js
export async function find<T>(
  type: string,
  query: Object = {},
  sort: Object = { created: 1 },
): Promise<Array<T>> {
  if (db._empty) return _dbNotInitialized();

  return new Promise((resolve, reject) => {
    db[type]
      .find(query)
      .sort(sort)
      .exec(async (err, rawDocs) => {
        if (err) {
          return reject(err);
        }

        const docs = [];
        for (const rawDoc of rawDocs) {
          docs.push(rawDoc);
        }
        resolve(docs);
      });
  });
}

export async function all<T>(type: string): Promise<Array<T>> {
  if (db._empty) return _dbNotInitialized();

  return find(type);
}

export async function getWhere<T>(type: string, query: Object): Promise<T | null> {
  if (db._empty) return _dbNotInitialized();

  const docs = await find(type, query);
  return docs.length ? docs[0] : null;
}
