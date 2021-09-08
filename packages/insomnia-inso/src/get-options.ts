import { cosmiconfigSync } from 'cosmiconfig';

import { GenerateConfigOptions } from './commands/generate-config';
import { UNKNOWN_OBJ } from './types';

interface ConfigFileOptions {
  __configFile?: {
    options?: UNKNOWN_OBJ;
    scripts?: UNKNOWN_OBJ;
    filePath: string;
  };
}

export type GlobalOptions = {
  appDataDir?: string;
  workingDir?: string;
  ci?: boolean;
  verbose?: boolean;
  printOptions?: boolean;
  config?: string;
  src?: string;
} & ConfigFileOptions;

const OptionsSupportedInConfigFile: (keyof GlobalOptions)[] = [
  'appDataDir',
  'workingDir',
  'ci',
  'verbose',
  'src',
  'printOptions',
];

export const loadCosmiConfig = (configFile?: string): Partial<ConfigFileOptions> => {
  try {
    const explorer = cosmiconfigSync('inso');
    const results = configFile ? explorer.load(configFile) : explorer.search();

    if (results && !results?.isEmpty) {
      const options: UNKNOWN_OBJ = {};
      OptionsSupportedInConfigFile.forEach(key => {
        const value = results.config?.options?.[key];

        if (value) {
          options[key] = value;
        }
      });
      return {
        __configFile: {
          options,
          scripts: results.config?.scripts || {},
          filePath: results.filepath,
        },
      };
    }
  } catch (e) {
    // Report fatal error when loading from explicitly defined config file
    if (configFile) {
      console.log(`Could not find config file at ${configFile}.`);
      console.error(e);
    }
  }

  return {};
};

interface CommandObj {
  parent?: CommandObj;
  opts: () => GenerateConfigOptions;
}

export const extractCommandOptions = <T extends GenerateConfigOptions>(cmd: CommandObj): Partial<T> => {
  let opts: Partial<T> = {};
  let command: CommandObj | undefined = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  return opts;
};

export const getOptions = <T extends Partial<GenerateConfigOptions>>(cmd: CommandObj, defaultOptions: Partial<T> = {}): Partial<T> => {
  const commandOptions = extractCommandOptions(cmd);
  const { __configFile } = loadCosmiConfig(commandOptions.config);

  if (__configFile) {
    return {
      ...defaultOptions,
      ...(__configFile.options || {}),
      ...commandOptions,
      __configFile,
    };
  }

  return {
    ...defaultOptions,
    ...commandOptions,
  };
};
