import { stat } from 'fs/promises';
import { CaCertificate } from 'insomnia/src/models/ca-certificate';
import { ClientCertificate } from 'insomnia/src/models/client-certificate';
import { CookieJar } from 'insomnia/src/models/cookie-jar';
import { Settings } from 'insomnia/src/models/settings';

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
  WorkspaceMeta,
} from './models/types';

export interface Database {
  ApiSpec: ApiSpec[];
  Environment: Environment[];
  Request: BaseModel[];
  RequestGroup: BaseModel[];
  Workspace: Workspace[];
  WorkspaceMeta: WorkspaceMeta[];
  UnitTestSuite: UnitTestSuite[];
  UnitTest: UnitTest[];
  ClientCertificate: ClientCertificate[];
  CaCertificate: CaCertificate[];
  CookieJar: CookieJar[];
  Settings: Settings[];
}

export const emptyDb = (): Database => ({
  ApiSpec: [],
  Environment: [],
  Request: [],
  RequestGroup: [],
  Workspace: [],
  WorkspaceMeta: [],
  UnitTest: [],
  UnitTestSuite: [],
  ClientCertificate: [],
  CaCertificate: [],
  CookieJar: [],
  Settings: [],
});

export type DbAdapter = (
  dir: string,
  filterTypes?: (keyof Database)[],
) => Promise<Database | null>;

interface Options {
  pathToSearch: string;
  filterTypes?: (keyof Database)[];
}

export const isFile = async (path: string) => {
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
     --workingDir/-w should point to a git repository root, an Insomnia export file or a directory containing Insomnia data.
      re-run with --verbose to see tracing information`,
  );

  return emptyDb();
};
