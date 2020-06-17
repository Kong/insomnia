// @flow
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { ApiSpec } from './types';

type Database = {|
  ApiSpec: Map<string, ApiSpec>,
  Environment: Map<string, Object>,
  Request: Map<string, Object>,
  RequestGroup: Map<string, Object>,
  Workspace: Map<string, Object>,
|};

export const emptyDb = (): Database => ({
  ApiSpec: new Map(),
  Environment: new Map(),
  Request: new Map(),
  RequestGroup: new Map(),
  Workspace: new Map(),
});

export const gitDataDirDb = async (dir?: string): Promise<Database> => {
  const db = emptyDb();
  const insomniaDir = path.normalize(path.join(dir || '.', '.insomnia'));

  if (!fs.existsSync(insomniaDir)) {
    // TODO: control logging with verbose flag
    // console.log(`Directory not found: ${insomniaDir}`);
    return db;
  }

  const readAndInsertDoc = async (type: $Keys<Database>, fileName: string): Promise<void> => {
    // Get contents of each file in type dir and insert into data
    const contents = await fs.promises.readFile(fileName);
    const obj = YAML.parse(contents.toString());

    db[type].set(obj._id, obj);
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
        files.map(file => readAndInsertDoc(type, path.join(insomniaDir, type, file))),
      );
    }),
  );

  return db;
};
