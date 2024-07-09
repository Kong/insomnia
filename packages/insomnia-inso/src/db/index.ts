import { stat } from 'fs/promises';

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
