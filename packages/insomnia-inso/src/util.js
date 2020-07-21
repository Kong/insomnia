// @flow
import * as packageJson from '../package.json';
import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';

type ConfigFileOptions = {
  __configFile?: {
    settings?: Object,
    scripts?: Object,
    filePath: string,
  },
};

export type GlobalOptions = {
  appDataDir?: string,
  workingDir?: string,
  ci?: boolean,
} & ConfigFileOptions;

export function getVersion() {
  return packageJson.version;
}

export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function loadCosmiConfig(workingDir: string, configFile?: string): ConfigFileOptions {
  try {
    const explorer = cosmiconfigSync('inso');
    const configPath = configFile ? path.join(workingDir, configFile) : undefined;
    const results = configPath ? explorer.load(configPath) : explorer.search();

    if (!results?.isEmpty) {
      return {
        __configFile: {
          settings: results.config?.settings || {},
          scripts: results.config?.scripts || {},
          filePath: results.filepath,
        },
      };
    }
  } catch (e) {
    // Report fatal error when loading from explicitly defined config file
    if (configFile) {
      console.error(e);
    }
  }

  return {};
}

export function getAllOptions<T>(cmd: Object, defaultOptions: $Shape<T> = {}): T {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  const { __configFile } = loadCosmiConfig(cmd.workingDir || '.', cmd.config);

  if (__configFile) {
    return {
      ...defaultOptions,
      ...(__configFile.settings || {}),
      ...opts,
      __configFile,
    };
  }

  return { ...defaultOptions, ...opts };
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
