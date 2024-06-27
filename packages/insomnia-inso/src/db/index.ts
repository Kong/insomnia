import { stat } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

import { logger } from '../cli';
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
  pathToSearch: string;
  filterTypes?: (keyof Database)[];
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
// Given a working Directory and src file, return the absolute path or fallback to insomnia app data directory
export const getAbsolutePathOrFallbackToAppDir = ({ workingDir, src }: { workingDir?: string; src?: string }) => {
  const hasWorkingDirOrSrc = workingDir || src;
  if (!hasWorkingDirOrSrc) {
    return getAppDataDir(getDefaultProductName());
  }
  return path.resolve(workingDir || process.cwd(), src || '');
};
export const getAbsoluteFilePath = ({ workingDir, file }: { workingDir?: string; file: string }) => {
  return path.isAbsolute(file) ? file : path.resolve(workingDir || process.cwd(), file);
};
const isFile = async (path: string) => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    return false;
  }
};
export const loadDb = async ({
  pathToSearch,
  filterTypes,
}: Options) => {
  // if path to file is provided try to it is an insomnia export file
  const isFilePath = await isFile(pathToSearch);
  if (isFilePath) {
    const exportDb = await insomniaExportAdapter(pathToSearch, filterTypes);
    if (exportDb) {
      logger.debug(`Data store configured from Insomnia export at \`${pathToSearch}\``);
      return exportDb;
    }
  }

  // try load from git
  const git = await gitAdapter(pathToSearch, filterTypes);
  git && logger.debug(`Data store configured from git repository at \`${pathToSearch}\``);
  if (git) {
    logger.debug(`Data store configured from git repository at \`${pathToSearch}\``);
    return git;
  }

  // try load from nedb
  const nedb = await neDbAdapter(pathToSearch, filterTypes);
  if (nedb) {
    logger.debug(`Data store configured from app data directory  at \`${pathToSearch}\``);
    return nedb;
  }

  logger.warn(
    `No git, app data store or Insomnia V4 export file found at path "${pathToSearch}",
      re-run --verbose to see tracing information`,
  );

  return emptyDb();
};
