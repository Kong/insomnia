// @flow
import type { ApiSpec, BaseModel, UnitTest, UnitTestSuite } from './types';
import envPaths from 'env-paths';
import gitAdapter from './adapters/git-adapter';
import neDbAdapter from './adapters/ne-db-adapter';

export type Database = {|
  ApiSpec: Array<ApiSpec>,
  Environment: Array<BaseModel>,
  Request: Array<BaseModel>,
  RequestGroup: Array<BaseModel>,
  Workspace: Array<BaseModel>,
  UnitTestSuite: Array<UnitTestSuite>,
  UnitTest: Array<UnitTest>,
|};

export const emptyDb = (): Database => ({
  ApiSpec: [],
  Environment: [],
  Request: [],
  RequestGroup: [],
  Workspace: [],
  UnitTest: [],
  UnitTestSuite: [],
});

export type DbAdapter = (
  dir: string,
  filterTypes?: Array<$Keys<Database>>,
) => Promise<Database | null>;

type Options = {
  workingDir?: string,
  appDataDir?: string,
  filterTypes?: Array<$Keys<Database>>,
};

export const loadDb = async ({
  workingDir,
  appDataDir,
  filterTypes,
}: Options = {}): Promise<Database> => {
  let db = null;

  // try load from git
  if (!appDataDir) {
    db = await gitAdapter(workingDir || '.', filterTypes);
  }

  // try load from nedb
  if (!db) {
    // TODO: Note, unit tests will also try to access the Insomnia Designer app data directory. We should configure this depending on development or production.
    db = await neDbAdapter(
      appDataDir || envPaths('insomnia-app', { suffix: '' }).data,
      filterTypes,
    );
  }

  // return empty db
  return db || emptyDb();
};

export const findFirst = <T: BaseModel>(arr: Array<T>, predicate: T => boolean): T => {
  const matched = arr.filter(predicate);

  if (matched.length === 0) {
    throw new Error('Could not find any entries matching the predicate.');
  }

  return matched[0];
};

export const findSingle = <T>(arr: Array<T>, predicate: T => boolean): T => {
  const matched = arr.filter(predicate);

  if (matched.length === 1) {
    return matched[0];
  }

  if (matched.length === 0) {
    throw new Error('Could not find any entries matching the predicate.');
  }

  throw new Error('Multiple entries found matching the predicate.');
};
