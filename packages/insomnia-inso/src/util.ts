import packageJson from '../package.json';
import { handleError } from './errors';

export const getVersion = () => {
  return process.env.VERSION || packageJson.version;
};

export const logErrorExit1 = (err?: Error) => {
  handleError(err);
  process.exit(1);
};

export const exit = async (result: Promise<boolean>): Promise<void> => {
  return result.then(r => process.exit(r ? 0 : 1)).catch(logErrorExit1);
};

export const getDefaultAppName = (): string => {
  const name = process.env.DEFAULT_APP_NAME;

  if (!name) {
    throw new Error('Environment variable DEFAULT_APP_NAME is not set.');
  }

  return name;
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
