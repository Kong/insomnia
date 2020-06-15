// @flow
import fs from 'fs';
import path from 'path';
import NeDB from 'nedb';
import YAML from 'yaml';

const db = ({
  _empty: true,
}: Object);

export async function init(dir: string = '.'): Promise<void> {
  const insomniaDir = path.normalize(path.join(dir, '.insomnia'));
  const types: Array<string> = await fs.promises.readdir(insomniaDir);

  for (const type of types) {
    db[type] = new NeDB();
  }

  delete db._empty;

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
    types.map(async type => {
      // Get all files in type dir
      const entries = await fs.promises.readdir(path.join(insomniaDir, type));
      return Promise.all(
        // Insert each file from each type
        entries.map(entry => readAndInsertDoc(path.join(insomniaDir, type, entry))),
      );
    }),
  );
}

async function _dbNotInitialized<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    reject(new Error('Db has not been initialized.'));
  });
}

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
