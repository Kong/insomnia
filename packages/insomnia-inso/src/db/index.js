// @flow
import type {
  ApiSpec,
  BaseModel,
  Environment,
  UnitTest,
  UnitTestSuite,
  Workspace,
} from './models/types';
import envPaths from 'env-paths';
import gitAdapter from './adapters/git-adapter';
import neDbAdapter from './adapters/ne-db-adapter';
import { getDefaultAppDataDir } from '../util';

export type Database = {|
  ApiSpec: Array<ApiSpec>,
  Environment: Array<Environment>,
  Request: Array<BaseModel>,
  RequestGroup: Array<BaseModel>,
  Workspace: Array<Workspace>,
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
    db = await neDbAdapter(
      appDataDir || envPaths(getDefaultAppDataDir(), { suffix: '' }).data,
      filterTypes,
    );
  }

  // return empty db
  return db || emptyDb();
};

export const mustFindSingleOrNone = <T>(arr: Array<T>, predicate: T => boolean): ?T => {
  const matched = arr.filter(predicate);

  if (matched.length === 1) {
    return matched[0];
  }

  if (matched.length === 0) {
    return null;
  }

  throw new Error(`Expected one or none, but found multiple matching entries`);
};

export const mustFindSingle = <T>(arr: Array<T>, predicate: T => boolean): T => {
  const matched = arr.filter(predicate);

  if (matched.length === 1) {
    return matched[0];
  }

  if (matched.length === 0) {
    throw new Error('Expected one but found no matching entries');
  }

  throw new Error('Expected one but found multiple matching entries');
};
