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
import logger from '../logger';
import path from 'path';

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
    const dir = workingDir || '.';
    db = await gitAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from git repository at \`${path.resolve(dir)}\``);
  }

  // try load from nedb
  if (!db) {
    const dir = appDataDir || envPaths(getDefaultAppDataDir(), { suffix: '' }).data;
    db = await neDbAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from app data directory at \`${path.resolve(dir)}\``);
  }

  // return empty db
  if (!db) {
    logger.warn(
      'No git or app data store found, re-run `inso` with `--verbose` to see tracing information',
    );
    db = emptyDb();
  }

  return db;
};
