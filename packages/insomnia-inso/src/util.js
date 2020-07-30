// @flow
import * as packageJson from '../package.json';
import consola from 'consola';
import { MultipleFoundError } from './db/models/util';

export function getVersion() {
  return packageJson.version;
}

export function logErrorExit1(err: Error) {
  if (err instanceof MultipleFoundError) {
    consola.fatal(err.message);
  } else {
    consola.error(err);
  }

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
