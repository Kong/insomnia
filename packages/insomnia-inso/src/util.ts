import packageJson from '../package.json';
import { handleError } from './errors';

export const getVersion = () => {
  return isDevelopment() ? 'dev' : packageJson.version;
};

export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
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

/**
 * Extract an object from a string array with a key=value format
 * (e.g var arr = ["prop1=value", "prop2=value" ...])
 * @param data An array of 'equal'(=) separated key value pairs
 */
export const parseObjFromKeyValuePair = (data: string[] = []): Record<string, unknown> => {
  // Placeholder data
  const obj: Record<string, unknown> = {};
  // Cycling for extraction each pair key-value
  data.forEach(arg => {
    // Extract option key-value
    const key = arg.substring(0, arg.indexOf('='));
    let value: unknown = arg.substring(arg.indexOf('=') + 1);
    // Everything is treated as a string, except:
    if (value === 'true' || value === 'false') value = value === 'true';
    else if (value === 'null') value = null;
    else if (value === 'undefined') value = undefined;
    else if (!isNaN(<number>value)) value = Number(value);
    // Assign
    obj[key] = value;
  });
  return obj;
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
