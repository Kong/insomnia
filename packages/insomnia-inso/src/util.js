// @flow
import * as packageJson from '../package.json';
import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';

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

type ConfigFileOptions = {
  configFile: {
    settings?: Object,
    scripts?: Object,
    filePath: string,
  },
};

function loadCosmiConfig(workingDir: string, configFile?: string): ?ConfigFileOptions {
  try {
    const explorer = cosmiconfigSync('inso');
    const configPath = configFile ? path.join(workingDir, configFile) : undefined;
    const results = configPath ? explorer.load(configPath) : explorer.search();

    if (!results?.isEmpty) {
      return {
        configFile: {
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

  return undefined;
}

export function getAllOptions<T>(
  cmd: Object,
  defaultOptions: $Shape<T> = {},
): T & ConfigFileOptions {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  const result = loadCosmiConfig(cmd.workingDir || '.', cmd.config);

  if (result) {
    return {
      ...defaultOptions,
      ...(result.configFile.settings || {}),
      ...opts,
      configFile: result.configFile,
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
