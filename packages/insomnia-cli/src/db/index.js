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
    // TODO: Note, unit tests will also try to access the Insomnia Designer app data directory. We should configure this depending on development or production.
    db = await neDbAdapter(
      appDataDir || envPaths('Insomnia Designer', { suffix: '' }).data,
      filterTypes,
    );
  }

  // return empty db
  return db || emptyDb();
}
