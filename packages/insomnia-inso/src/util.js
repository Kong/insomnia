// @flow
import * as packageJson from '../package.json';
import { handleError } from './errors';

export function getVersion() {
  return isDevelopment() ? 'dev' : packageJson.version;
}

export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export function logErrorExit1(err?: Error) {
  handleError(err);
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
