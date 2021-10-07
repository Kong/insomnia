import { readFileSync } from 'fs';
import { Settings } from 'insomnia-common';
import { InsomniaConfig, validate } from 'insomnia-config';
import { resolve } from 'path';
import { mapObjIndexed, mergeRight, once } from 'ramda';
import { omitBy } from 'ramda-adjunct';
import { ValueOf } from 'type-fest';

/**
 * IMPORTANT: Due to a business rule that the config is never changed after startup, this should only be called by `getConfigSettings` below.  It is only exported
 *
 * @deprecated this is not actually deprecated, but the strikethrough is to warn not to use this function (ever) outside of tests.
 */
export const readConfigFile = (path: string) => () => {
  const file = resolve(path);
  const insomniaConfig = JSON.parse(String(readFileSync(file))) as InsomniaConfig;

  const { valid, errors } = validate(insomniaConfig);
  if (!valid) {
    console.error('invalid insomnia config', errors);
    return {};
  }
  // This cast is important for testing intentionally bad values (the above validation will catch it, anyway)
  return insomniaConfig.settings as Required<InsomniaConfig>['settings'] || {};
};

/** gets settings from the `insomnia.config.json` */
export const getConfigSettings = once(readConfigFile('../../packages/insomnia-app/app/insomnia.config.json'));

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

/**
 * For any given setting, return what the value of that setting should be once you take the insomnia config and other potentially controlling settings into account
 */
export const getControlledValue = (settings: Settings) => (value: ValueOf<Settings>, setting: keyof Settings) => {

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
  return value;
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
