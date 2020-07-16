// @flow
import * as packageJson from '../package.json';
import { cosmiconfigSync } from 'cosmiconfig';

export type GlobalOptions = {
  appDataDir?: string,
  workingDir?: string,
  ci?: boolean,
};

export function getVersion() {
  return packageJson.version;
}

export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export function getCosmiConfig(): {
  config: Object,
  filepath: string,
  isEmpty?: boolean,
} | null {
  return cosmiconfigSync('inso').search();
}

export function getAllOptions<T>(cmd: Object): T {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  try {
    const config = getCosmiConfig()?.config?.settings || {};
    return { ...config, ...opts };
  } catch (e) {
    // Fatal error when loading config file
    console.error(e);
  }

  return opts;
}

export function logErrorExit1(err: Error) {
  console.error(err);

  process.exit(1);
}

export async function exit(result: Promise<boolean>): Promise<void> {
  return result.then(r => process.exit(r ? 0 : 1)).catch(logErrorExit1);
}

export function getDefaultAppDataDir(): string {
  const dir = process.env.DEFAULT_APP_DATA_DIR;

  if (!dir) {
    throw new Error('Environment variable DEFAULT_APP_DATA_DIR is not set.');
  }

  return dir;
}
