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
  quiet?: boolean;
  printOptions?: boolean;
  config?: string;
  src?: string;
} & ConfigFileOptions;

export const OptionsSupportedInConfigFile: (keyof GlobalOptions)[] = [
  'appDataDir',
  'workingDir',
  'ci',
  'quiet',
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

export const getOptions = (defaultOptions: Partial<GlobalOptions> = {}): Partial<GlobalOptions> => {
  const { __configFile } = loadCosmiConfig(defaultOptions.config);

  if (__configFile) {
    return {
      ...defaultOptions,
      ...(__configFile.options || {}),
      __configFile,
    };
  }

  return defaultOptions;
};
