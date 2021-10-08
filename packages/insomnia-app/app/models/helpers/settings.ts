import { readFileSync } from 'fs';
import { Settings } from 'insomnia-common';
import { InsomniaConfig, validate } from 'insomnia-config';
import { resolve } from 'path';
import { mapObjIndexed, mergeRight, once } from 'ramda';
import { omitBy } from 'ramda-adjunct';

import { isDevelopment } from '../../common/constants';
import { getDataDirectory, getPortableExecutableDir } from '../../common/electron-helpers';

/** takes an unresolved (or resolved will work fine too) filePath of the insomnia config and reads the insomniaConfig from disk */
const readConfigFile = (filePath: string) => {
  try {
    const resolvedFilePath = resolve(filePath);
    const fileContents = readFileSync(resolvedFilePath, 'utf-8');
    return JSON.parse(fileContents) as unknown;
  } catch (error: unknown) {
    return undefined;
  }
};

const getConfigFile = () => {
  const processExecutable = getPortableExecutableDir() || '';
  const insomniaDataDirectory = getDataDirectory();
  const localDev = '../../packages/insomnia-app/app/insomnia.config.json';
  const configPaths = [
    processExecutable,
    insomniaDataDirectory,
    ...(isDevelopment() ? [localDev] : []),
  ];

  // note: this is written as to avoid unnecessary (synchronous) reads from disk.
  // The paths above are in priority order such that if we already found what we're looking for, there's no reason to keep reading other files.
  for (const configPath of configPaths) {
    const insomniaConfig = readConfigFile(configPath);
    if (insomniaConfig !== undefined) {
      return {
        insomniaConfig,
        configPath,
      };
    }
  }
  return {
    insomniaConfig: { insomniaConfig: '1.0.0' },
    configPath: '<internal>',
  };
};

/**
 * IMPORTANT: Due to a business rule that the config is never changed after startup, this should only be called by `getConfigSettings` below.  It is only extracted and exported due to tests needing to have it as a separate function so that it can be mocked (or not mocked).  Otherwise it would be inlined.
 *
 * @deprecated this is not actually deprecated, but the strikethrough is to warn not to use this function (ever) outside of tests.
 */
export const getValidConfigSettings = () => {
  const { configPath, insomniaConfig } = getConfigFile();

  const { valid, errors } = validate(insomniaConfig as InsomniaConfig);
  if (!valid) {
    console.error('invalid insomnia config', {
      configPath,
      insomniaConfig,
      errors,
    });
    return {};
  }
  // This cast is important for testing intentionally bad values (the above validation will catch it, anyway)
  return (insomniaConfig as InsomniaConfig).settings || {};
};

/** gets settings from the `insomnia.config.json` */
export const getConfigSettings = once(getValidConfigSettings);

interface Condition {
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
export const isControlledByConfig = (setting: keyof Settings) => (
  Boolean(Object.prototype.hasOwnProperty.call(getConfigSettings(), setting))
);

/**
 * checks whether a given setting is controlled by another setting.
 * if so, it will return that setting id.  otherwise it will return false.
 */
export const isControlledByAnotherSetting = (settings: Settings) => (setting: keyof Settings) => {
  for (const [controller, controlledSettings] of settingControllers.entries()) {
    for (const { when, set } of controlledSettings) {
      if (Object.prototype.hasOwnProperty.call(set, setting)) {
        if (when === settings[controller]) {
          return {
            controlledValue: set[setting],
            controller,
            isControlled: true,
          };
        }
      }
    }
  }
  return {
    isControlled: false,
  };
};

export const isControlledSetting = (settings: Settings) => (setting: keyof Settings) => {
  if (isControlledByConfig(setting)) {
    const {
      isControlled,
      controller,
    } = isControlledByAnotherSetting({
      ...settings,
      ...getConfigSettings(),
    })(setting);
    if (isControlled && controller && isControlledByConfig(controller)) {
      return [true, controller] as const;
    }

    return [true, 'insomnia-config'] as const;
  }

  const {
    isControlled,
    controller,
  } = isControlledByAnotherSetting(settings)(setting);
  if (isControlled) {
    return [true, controller] as const;
  }

  return [false, null] as const;
};

/**
 * For any given setting, return what the value of that setting should be once you take the insomnia config and other potentially controlling settings into account
 */
export const getControlledValue = (settings: Settings) => (_value, setting: keyof Settings) => {
  if (isControlledByConfig(setting)) {
    const configSettings = {
      ...settings,
      ...getConfigSettings(),
    };

    const {
      controller,
      controlledValue,
      isControlled: anotherSettingControls,
    } = isControlledByAnotherSetting(configSettings)(setting);

    // TLDR; the config always wins
    // It is a business rule that if a setting (e.g. `incognitoMode` specified in the config controlls another setting (e.g. `enableAnalytics`), that conflict should be resolved such that the config-specified controller should _always_ win, _even_ if the controlled setting (i.e. `enableAnalytics`) is _itself_ specified in the config with a conflicting value)
    if (anotherSettingControls && controller && isControlledByConfig(controller)) {
      return controlledValue;
    }
    // no other setting controls this, so we can grab it from the config itself
    return configSettings[setting];
  }

  const {
    controlledValue,
    isControlled: anotherSettingControls,
  } = isControlledByAnotherSetting(settings)(setting);
  if (anotherSettingControls) {
    return controlledValue;
  }

  // return the object unchanged, as it exists in the settings
  return settings[setting];
};

/** removes any setting in the given object which is controlled in any way (i.e. either by the insomnia config or by another setting) */
export const omitControlledSettings =
  <T extends Settings>(settings: T) =>
  <U extends Partial<Settings>>(patch: U) => {
    return omitBy((_value, setting: keyof Settings) => {
      return (
        isControlledByConfig(setting)
      || isControlledByAnotherSetting(settings)(setting).isControlled
      );
    }, patch);
  };

/** for any given setting, whether controlled by the insomnia config or whether controlled by another value, return the calculated value */
export const getControlledSettings = <T extends Settings>(settings: T) => {
  const override = mapObjIndexed(getControlledValue(settings), settings) as T;
  return mergeRight(settings, override) as T;
};
