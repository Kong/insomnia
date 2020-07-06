// @flow
import type { ApiSpec, BaseModel } from './types';
import envPaths from 'env-paths';
import gitAdapter from './adapters/git-adapter';
import neDbAdapter from './adapters/ne-db-adapter';

export type Database = {|
  ApiSpec: Array<ApiSpec>,
  Environment: Array<BaseModel>,
  Request: Array<BaseModel>,
  RequestGroup: Array<BaseModel>,
  Workspace: Array<BaseModel>,
|};

export function emptyDb(): Database {
  return {
    ApiSpec: [],
    Environment: [],
    Request: [],
    RequestGroup: [],
    Workspace: [],
  };
}

export type DbAdapter = (
  dir: string,
  filterTypes?: Array<$Keys<Database>>,
) => Promise<Database | null>;

type Options = {
  workingDir?: string,
  appDataDir?: string,
  filterTypes?: Array<$Keys<Database>>,
};

export async function loadDb({
  workingDir,
  appDataDir,
  filterTypes,
}: Options = {}): Promise<Database> {
  let db = null;

  // try load from git
  if (!appDataDir) {
    db = await gitAdapter(workingDir || '.', filterTypes);
  }

  // try load from nedb
  if (!db) {
    db = await neDbAdapter(
      appDataDir ||
        envPaths(process.env.DEFAULT_APP_DATA_DIR || 'insomnia-app', { suffix: '' }).data,
      filterTypes,
    );
  }

  // return empty db
  return db || emptyDb();
}
