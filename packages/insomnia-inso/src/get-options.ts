import { cosmiconfigSync } from 'cosmiconfig';

interface ConfigFileOptions {
  __configFile?: {
    options?: GlobalOptions;
    scripts?: {
      lint: string;
    };
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

export const OptionsSupportedInConfigFile: (keyof GlobalOptions)[] = [
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
      const options: GlobalOptions = {};
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
  } catch (error) {
    // Report fatal error when loading from explicitly defined config file
    if (configFile) {
      console.log(`Could not find config file at ${configFile}.`);
      console.error(error);
    }
  }

  return {};
};

interface CommandObj {
  parent?: CommandObj;
  opts: () => GlobalOptions;
}

export const extractCommandOptions = <T extends GlobalOptions>(cmd: CommandObj): Partial<T> => {
  let opts: Partial<T> = {};
  let command: CommandObj | undefined = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  return opts;
};

export const getOptions = <T extends Partial<GlobalOptions>>(cmd: CommandObj, defaultOptions: Partial<T> = {}): Partial<T> => {
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
