// @flow
import { cosmiconfigSync } from 'cosmiconfig';

type ConfigFileOptions = {
  __configFile?: {
    options?: Object,
    scripts?: Object,
    filePath: string,
  },
};

export type GlobalOptions = {
  appDataDir?: string,
  workingDir?: string,
  ci?: boolean,
  verbose?: boolean,
  printOptions?: boolean,
  config?: string,
} & ConfigFileOptions;

const OptionsSupportedInConfigFile: Array<$Keys<GlobalOptions>> = [
  'appDataDir',
  'workingDir',
  'ci',
  'verbose',
  'printOptions',
];

export const loadCosmiConfig = (configFile?: string): ConfigFileOptions => {
  try {
    const explorer = cosmiconfigSync('inso');

    const results = configFile ? explorer.load(configFile) : explorer.search();

    if (results && !results?.isEmpty) {
      const options = {};

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

export const extractCommandOptions = <T>(cmd: Object): $Shape<T> => {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  return opts;
};

const getOptions = <T>(cmd: Object, defaultOptions: $Shape<T> = {}): T => {
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

  return { ...defaultOptions, ...commandOptions };
};

export default getOptions;
