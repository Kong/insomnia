import { homedir } from 'os';
import path from 'path';

import { logger } from '../logger';
import gitAdapter from './adapters/git-adapter';
import insomniaExportAdapter from './adapters/insomnia-adapter';
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

/**
 * getAppDataDir returns the data directory for an Electron app,
 * it is equivalent to the app.getPath('userData') API in Electron.
 * https://www.electronjs.org/docs/api/app#appgetpathname
*/
export function getAppDataDir(app: string): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(homedir(), 'Library', 'Application Support', app);
    case 'win32':
      return path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), app);
    case 'linux':
      return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.config'), app);
    default:
      throw new Error('Unsupported platform');
  }
}
export const getDefaultProductName = (): string => {
  const name = process.env.DEFAULT_APP_NAME;

  if (!name) {
    throw new Error('Environment variable DEFAULT_APP_NAME is not set.');
  }

  return name;
};

export const loadDb = async ({
  workingDir,
  filterTypes,
  src,
}: Options = {}) => {
  let db: Database | null = null;
  let resolvedDirectory;
  if (workingDir) {
    resolvedDirectory = path.resolve(workingDir, src || '');
  }
  if (!workingDir && src) {
    resolvedDirectory = path.resolve('.', src);
  }
  const specifiedDirectory = resolvedDirectory || '.';
  const fallbackDirectory = resolvedDirectory || getAppDataDir(getDefaultProductName());
  // try load from git
  db = await gitAdapter(specifiedDirectory, filterTypes);
  db && logger.debug(`Data store configured from git repository at \`${specifiedDirectory}\``);

  // try load from export file (higher priority)
  if (!db) {
    db = await insomniaExportAdapter(specifiedDirectory, filterTypes);
    db && logger.debug(`Data store configured from Insomnia export file at \`${specifiedDirectory}\``);
  }

  // try load from nedb
  if (!db) {
    db = await neDbAdapter(fallbackDirectory, filterTypes);
    db && logger.debug(`Data store configured from app data directory at \`${fallbackDirectory}\``); // Try to load from the Designer data dir, if the Core data directory does not exist
  } // return empty db

  if (!db) {
    logger.warn(
      `No git, app data store or Insomnia V4 export file found at path "${specifiedDirectory} or ${fallbackDirectory}",
      re-run --verbose to see tracing information`,
    );
    db = emptyDb();
  }

  return db;
};
