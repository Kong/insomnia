import path from 'path';

import { getAppDataDir } from '../data-directory';
import { logger } from '../logger';
import { getDefaultAppName } from '../util';
import gitAdapter from './adapters/git-adapter';
import insomniaAdapter from './adapters/insomnia-adapter';
import neDbAdapter from './adapters/ne-db-adapter';
import type {
  ApiSpec,
  BaseModel,
  Environment,
  UnitTest,
  UnitTestSuite,
  Workspace,
} from './models/types';

export interface Database {
  ApiSpec: ApiSpec[];
  Environment: Environment[];
  Request: BaseModel[];
  RequestGroup: BaseModel[];
  Workspace: Workspace[];
  UnitTestSuite: UnitTestSuite[];
  UnitTest: UnitTest[];
}

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
  filterTypes?: (keyof Database)[],
) => Promise<Database | null>;

interface Options {
  workingDir?: string;
  appDataDir?: string;
  filterTypes?: (keyof Database)[];
  src?: string;
}

export const loadDb = async ({
  workingDir,
  appDataDir,
  filterTypes,
  src,
}: Options = {}) => {
  let db: Database | null = null;

  // try load from git
  if (!appDataDir) {
    const dir = src || workingDir || '.';
    db = await gitAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from git repository at \`${path.resolve(dir)}\``);
  }

  // try load from file (higher priority)
  if (!db && src) {
    db = await insomniaAdapter(src, filterTypes);
    db && logger.debug(`Data store configured from file at \`${path.resolve(src)}\``);
  }

  // try load from nedb
  if (!db) {
    const dir = src || appDataDir || getAppDataDir(getDefaultAppName());
    db = await neDbAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from app data directory at \`${path.resolve(dir)}\``); // Try to load from the Designer data dir, if the Core data directory does not exist

    if (!db && !appDataDir && !src) {
      const designerDir = getAppDataDir('Insomnia Designer');
      db = await neDbAdapter(designerDir);
      db &&
        logger.debug(
          `Data store configured from Insomnia Designer app data directory at \`${path.resolve(
            designerDir,
          )}\``,
        );
    }
  } // return empty db

  appDataDir && logger.warn(
    'The option `--appDataDir` has been deprecated and will be removed in future releases. Please use `--src` as an alternative',
  );

  if (!db) {
    logger.warn(
      'No git, app data store or Insomnia V4 export file found, re-run `inso` with `--verbose` to see tracing information',
    );
    db = emptyDb();
  }

  return db;
};
