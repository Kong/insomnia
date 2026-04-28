import { stat } from 'node:fs/promises';

import { logger } from '../logger';
import gitAdapter from './adapters/git-adapter';
import insomniaExportAdapter from './adapters/insomnia-adapter';
import neDbAdapter from './adapters/ne-db-adapter';
import type { Database } from './types';
import { emptyDb } from './types';

interface Options {
  pathToSearch: string;
  filterTypes?: (keyof Database)[];
}

export const isFile = async (path: string) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};
export const loadDb = async ({ pathToSearch, filterTypes }: Options) => {
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
    `Error: No data source found at path "${pathToSearch}".
  TIP: Use "--workingDir/-w" to specify one of the following:
    - A Git repository root
    - An Insomnia export file
    - A directory containing Insomnia data
  
  Examples:
    1. Using a (legacy) Git repository:
       $ inso run collection --workingDir /path/to/git-repo
  
    2. Using an Insomnia export file or inside a Git project:
       $ inso run collection --workingDir /path/to/insomnia-file.yaml
  
    3. Using a directory with Insomnia app data:
       $ inso run collection --workingDir /path/to/insomnia-data
  
  Re-run with "--verbose" for more details.`,
  );

  return emptyDb();
};
