import { readFileSync } from 'fs';
import { Settings } from 'insomnia-common';
import { ErrorResult, INSOMNIA_CONFIG_FILENAME, InsomniaConfig, isErrorResult, validate } from 'insomnia-config';
import { resolve } from 'path';
import { mapObjIndexed, once } from 'ramda';
import { omitBy } from 'ramda-adjunct';
import { ValueOf } from 'type-fest';

import { isDevelopment } from '../../common/constants';
import { getDataDirectory, getPortableExecutableDir } from '../../common/electron-helpers';

interface FailedParseResult {
  syntaxError: SyntaxError;
  fileContents: string;
  configPath: string;
}

const isFailedParseResult = (input: any): input is FailedParseResult => {
  const typesafeInput = input as FailedParseResult;

  return (
    typesafeInput ? typesafeInput.syntaxError instanceof SyntaxError : false
  );
};

/** takes an unresolved (or resolved will work fine too) filePath of the insomnia config and reads the insomniaConfig from disk */
export const readConfigFile = (configPath?: string): unknown | FailedParseResult | undefined => {
  if (!configPath) {
    return undefined;
  }

  let fileContents = '';
  try {
    fileContents = readFileSync(configPath, 'utf-8');
  } catch (error: unknown) {
    // file not found
    return undefined;
  }

  const fileIsFoundButEmpty = fileContents === '';
  if (fileIsFoundButEmpty) {
    return undefined;
  }

  try {
    return JSON.parse(fileContents) as unknown;
  } catch (syntaxError: unknown) {
    // note: all JSON.parse errors are SyntaxErrors
    // see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/JSON_bad_parse
    if (syntaxError instanceof SyntaxError) {
      console.error('failed to parse insomnia config', { configPath, fileContents, syntaxError });
      const failedParseResult: FailedParseResult = {
        syntaxError,
        fileContents,
        configPath: configPath,
      };
      return failedParseResult;
    }
    return undefined;
  }
};

export const getLocalDevConfigFilePath = () => (
  isDevelopment() ? '../../packages/insomnia-app/app' as string : undefined
);

const addConfigFileToPath = (path: string | undefined) => (
  path ? resolve(path, INSOMNIA_CONFIG_FILENAME) : undefined
);

export const getConfigFile = () => {
  const portableExecutable = getPortableExecutableDir();
  const insomniaDataDirectory = getDataDirectory();
  const localDev = getLocalDevConfigFilePath();
  const configPaths = [
    portableExecutable,
    insomniaDataDirectory,
    localDev,
  ].map(addConfigFileToPath);

  // note: this is written as to avoid unnecessary (synchronous) reads from disk.
  // The paths above are in priority order such that if we already found what we're looking for, there's no reason to keep reading other files.
  for (const configPath of configPaths) {
    const fileReadResult = readConfigFile(configPath);
    if (isFailedParseResult(fileReadResult)) {
      return fileReadResult;
    }

    if (fileReadResult !== undefined && configPath !== undefined) {
      return {
        insomniaConfig: fileReadResult,
        configPath,
      };
    }
  }
  const fallbackEmptyConfig: InsomniaConfig = { insomniaConfig: '1.0.0' };
  return {
    insomniaConfig: fallbackEmptyConfig,
    configPath: '<internal fallback insomnia config>',
  };
};

export interface ConfigError {
  error: {
    configPath?: string;
    insomniaConfig: unknown;
    errors: ErrorResult['errors'];
    humanReadableErrors: ErrorResult['humanReadableErrors'];
  };
}

export const isConfigError = (input: ConfigError | ParseError): input is ConfigError => (
  // Cast for typesafety
  (input as ConfigError).error?.humanReadableErrors?.length > 0
);

export interface ParseError {
  error: FailedParseResult;
}

export const isParseError = (input: ConfigError | ParseError): input is ParseError => (
  isFailedParseResult(input.error)
);

/**
 * gets settings from the `insomnia.config.json`
 *
 * note that it is a business rule that the config is never read again after startup, hence the `once` usage.
 */
export const getConfigSettings: () => (NonNullable<InsomniaConfig['settings']> | ConfigError | ParseError) = once(() => {
  const configFileResult = getConfigFile();

  if (isFailedParseResult(configFileResult)) {
    return {
      error: configFileResult,
    };
  }

  const { insomniaConfig, configPath } = configFileResult;
  const validationResult = validate(insomniaConfig as InsomniaConfig);

  if (isErrorResult(validationResult)) {
    const { errors, humanReadableErrors } = validationResult;
    const error = {
      configPath,
      insomniaConfig,
      errors,
      humanReadableErrors,
    };

    console.error('invalid insomnia config', error);
    return { error };
  }

  // This cast is important for testing intentionally bad values (the above validation will catch it, anyway)
  return (insomniaConfig as InsomniaConfig).settings || {};
});

interface Condition {
  /** note: conditions are only suitable for boolean settings at this time */
  when: boolean;
  set: Partial<Settings>;
}

// using a Map because they are ordered (in such case as multiple settings could be controlled by other multiple settings in the future, we could control this reliably by changing the order in the Map)
const settingControllers = new Map<keyof Settings, Condition[]>([
  [
    'incognitoMode',
    [
      {
        when: true,
        set: {
          enableAnalytics: false,
          allowNotificationRequests: false,
        },
      },
    ],
  ],
]);

/** checks whether a given setting is literally specified in the insomnia config */
export const isControlledByConfig = (setting: keyof Settings | null) => setting ? (
  Boolean(Object.prototype.hasOwnProperty.call(getConfigSettings(), setting))
) : false;

export interface SettingControlledSetting<T extends keyof Settings> {
  controlledValue: Settings[T];
  controller: keyof Settings;
  isControlled: true;
}

export interface ConfigControlledSetting<T extends keyof Settings> {
  controlledValue: Settings[T];
  controller: 'insomnia-config';
  isControlled: true;
}

export interface UncontrolledSetting {
  controller: null;
  isControlled: false;
}

export type SettingsControl<T extends keyof Settings> =
  | SettingControlledSetting<T>
  | ConfigControlledSetting<T>
  | UncontrolledSetting
;

const isSettingControlledByCondition = (condition: Condition, setting: keyof Settings, value: ValueOf<Settings>) => {
  return condition.when === value
    && Object.prototype.hasOwnProperty.call(condition.set, setting);
};

/**
 * checks whether a given setting is controlled by another setting.
 * if so, it will return that setting id.  otherwise it will return false.
 */
export const isControlledByAnotherSetting = (settings: Settings) => (setting: keyof Settings) => {
  for (const [controller, controlledSettings] of settingControllers.entries()) {
    for (const condition of controlledSettings) {
      if (isSettingControlledByCondition(condition, setting, settings[controller])) {
        const output: SettingControlledSetting<typeof setting> = {
          controlledValue: condition.set[setting],
          controller,
          isControlled: true,
        };
        return output;
      }
    }
  }
  const uncontrolledSetting: UncontrolledSetting = {
    controller: null,
    isControlled: false,
  };
  return uncontrolledSetting;
};

/**
 * For any given setting, return what the value of that setting should be once you take the insomnia config and other potentially controlling settings into account
 */
export const getControlledStatus = (userSettings: Settings) => (setting: keyof Settings) => {
  const configSettings = {
    ...userSettings,
    ...getConfigSettings(),
  };

  if (isControlledByConfig(setting)) {

    // note that the raw config settings are being passed here (rathern than `settings` alone), because we must verify that the controller does not itself also have a specification in the config
    const controllerSetting = isControlledByAnotherSetting(configSettings)(setting);

    // TLDR; the config always wins
    // It is a business rule that if a setting (e.g. `incognitoMode` specified in the config controlls another setting (e.g. `enableAnalytics`), that conflict should be resolved such that the config-specified controller should _always_ win, _even_ if the controlled setting (i.e. `enableAnalytics`) is _itself_ specified in the config with a conflicting value)
    if (controllerSetting.isControlled && isControlledByConfig(controllerSetting.controller)) {
      // since this setting is also controlled by a controller, and that controller is controlled by the config, we use the controller's desired value for this setting.
      return {
        controller: controllerSetting.controller,
        isControlled: true,
        value: controllerSetting.controlledValue,
      };
    }

    // no other setting controls this, so we can grab its value the config directly
    return {
      controller: 'insomnia-config',
      isControlled: true,
      value: configSettings[setting],
    };
  }

  const thisSetting = isControlledByAnotherSetting(configSettings)(setting);
  if (thisSetting.isControlled) {
    // this setting is controlled by another setting.
    return {
      controller: thisSetting.controller,
      isControlled: true,
      value: thisSetting.controlledValue,
    };
  }

  // return the object unchanged, as it exists in the settings
  return {
    controller: null,
    isControlled: false,
    value: userSettings[setting],
  };
};

/** removes any setting in the given patch object which is controlled in any way (i.e. either by the insomnia config or by another setting) */
export const omitControlledSettings = <
  T extends Settings,
  U extends Partial<Settings>
>(settings: T, patch: U) => {
  return omitBy((_value, setting: keyof Settings) => (
    getControlledStatus(settings)(setting).isControlled
  ), patch);
};

/** for any given setting, whether controlled by the insomnia config or whether controlled by another value, return the calculated value */
export const getMonkeyPatchedControlledSettings = <T extends Settings>(settings: T) => {
  const override = mapObjIndexed((_value, setting: keyof Settings) => (
    getControlledStatus(settings)(setting).value
  ), settings) as T;
  return {
    ...settings,
    ...override,
  };
};
