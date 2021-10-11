import { Settings } from 'insomnia-common';
import { mocked } from 'ts-jest/utils';

import * as models from '../../../models';
import {
  getConfigSettings as _getConfigSettings,
  getControlledSettings,
  getControlledStatus,
  omitControlledSettings,
} from '../settings';

jest.mock('../settings');
const getConfigSettings = mocked(_getConfigSettings);

describe('getControlledStatus', () => {
  it('should override conflicting setting if controlled by another setting', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true, // this intentionally conflicts with incognito mode
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'incognitoMode',
      value: false,
    });
  });

  it('should override setting with what is defined in the config file', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: false });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: false, // ensures incognito mode isn't affecting this test
      enableAnalytics: true, // this intentionally conflicts with the config
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'insomnia-config',
      value: false,
    });
  });

  it('should override setting controlled by another setting, with what is defined in the config file', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: true }); // intentionally conflicts with incognito mode
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true, // this intentionally conflicts with the config
      enableAnalytics: false, // this intentionally conflicts with the config
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'insomnia-config',
      value: true,
    });
  });
});

describe('omitControlledSettings', () => {
  it('omits config controlled settings', () => {
    getConfigSettings.mockReturnValue({ disablePaidFeatureAds: true });
    const settings = models.settings.init();

    const result = omitControlledSettings(settings, { disablePaidFeatureAds: false });

    expect(result).not.toHaveProperty('disablePaidFeatureAds');
  });

  it('does not omit settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = omitControlledSettings(settings, { disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('omits settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
    };
    const result = omitControlledSettings(settings, { enableAnalytics: true });

    expect(result).not.toHaveProperty('enableAnalytics');
  });

  it('does not omit settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();
    const result = omitControlledSettings(settings, { disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });
});

describe('getControlledSettings', () => {
  it('overwrites config controlled settings', () => {
    getConfigSettings.mockReturnValue({ disablePaidFeatureAds: true });
    const settings: Settings = {
      ...models.settings.init(),
      disablePaidFeatureAds: false,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('does not overwrite settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      disablePaidFeatureAds: true,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('overwrites settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ enableAnalytics: false });
  });

  it('does not overwrite settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      disablePaidFeatureAds: true,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('prioritizes config control over simple settings control', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: true });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: false,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ enableAnalytics: true });
  });

  it('config _and_ settings control gets highest possible priority', () => {
    getConfigSettings.mockReturnValue({
      incognitoMode: true,
      enableAnalytics: true, // this intentionally conflicts with incognitoMode, which should force it to false
    });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: false, // this intentionally conflicts with the config
      enableAnalytics: false,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({
      incognitoMode: true,
      enableAnalytics: false,
    });
  });
});
