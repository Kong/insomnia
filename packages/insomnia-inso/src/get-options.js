// @flow
import { cosmiconfigSync } from 'cosmiconfig';

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

export const loadCosmiConfig = (configFile?: string): ConfigFileOptions => {
  try {
    const explorer = cosmiconfigSync('inso');

    const results = configFile ? explorer.load(configFile) : explorer.search();

    if (results && !results?.isEmpty) {
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
      ...(__configFile.settings || {}),
      ...commandOptions,
      __configFile,
    };
  }

  return { ...defaultOptions, ...commandOptions };
};

export default getOptions;
