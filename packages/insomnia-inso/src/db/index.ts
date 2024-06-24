import path from 'path';

import { getAppDataDir } from '../data-directory';
import { logger } from '../logger';
import { getDefaultProductName } from '../util';
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
  filterTypes?: (keyof Database)[];
  src?: string;
}

export const loadDb = async ({
  workingDir,
  filterTypes,
  src,
}: Options = {}) => {
  let db: Database | null = null;
  let userSpecifiedDirectory = '.';
  if (workingDir) {
    userSpecifiedDirectory = path.resolve(workingDir, src || '');
  }
  if (!workingDir && src) {
    userSpecifiedDirectory = path.resolve('.', src);
  }
  const fullPath = userSpecifiedDirectory || '.';
  // try load from git
  db = await gitAdapter(fullPath, filterTypes);
  db && logger.debug(`Data store configured from git repository at \`${fullPath}\``);

  // try load from file (higher priority)
  if (!db) {
    db = await insomniaAdapter(fullPath, filterTypes);
    db && logger.debug(`Data store configured from file at \`${fullPath}\``);
  }

  // try load from nedb
  if (!db) {
    const dir = userSpecifiedDirectory || getAppDataDir(getDefaultProductName());
    db = await neDbAdapter(dir, filterTypes);
    db && logger.debug(`Data store configured from app data directory at \`${dir}\``); // Try to load from the Designer data dir, if the Core data directory does not exist
  } // return empty db

  if (!db) {
    logger.warn(
      'No git, app data store or Insomnia V4 export file found, re-run `inso` with `--verbose` to see tracing information',
    );
    db = emptyDb();
  }

  return db;
};
