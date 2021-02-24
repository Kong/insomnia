// @flow
import type {
  ApiSpec,
  BaseModel,
  Environment,
  UnitTest,
  UnitTestSuite,
  Workspace,
} from './models/types';
import gitAdapter from './adapters/git-adapter';
import neDbAdapter from './adapters/ne-db-adapter';
import { getDefaultAppName } from '../util';
import { getAppDataDir } from '../data-directory';
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
    const dir = appDataDir || getAppDataDir(getDefaultAppName());
    db = await neDbAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from app data directory at \`${path.resolve(dir)}\``);

    // Try to load from the Designer data dir, if the Core data directory does not exist
    if (!db && !appDataDir) {
      const designerDir = getAppDataDir('Insomnia Designer');
      db = await neDbAdapter(designerDir);
      db &&
        logger.debug(
          `Data store configured from Insomnia Designer app data directory at \`${path.resolve(
            designerDir,
          )}\``,
        );
    }
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
