import { Settings } from 'insomnia-common';
import { mocked } from 'ts-jest/utils';

import * as models from '../../../models';
import {
  getConfigSettings as _getConfigSettings,
  getControlledSettings,
  getControlledValue,
  omitControlledSettings,
} from '../settings';

jest.mock('../settings');
const getConfigSettings = mocked(_getConfigSettings);

describe('getControlledValue', () => {
  it('resolve conflicting value', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true, // this intionally conflicts with incognito mode
    };

    const controlledValue = getControlledValue(settings)(true, 'enableAnalytics');

    expect(controlledValue).toBe(false);
  });

  it('config control gets priority over simple settings control', () => {
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

    expect(result).toMatchObject({ enableAnalytics: false });
  });

  it('only reads the config once on startup and then never again', async () => {
    // const someKindOfSpy = ??

    getConfigSettings();
    getConfigSettings();

    // TODO - no one on the team knows how we can test this, despite a few collective man-hours of trying every approach we can think of
    // expect(someKindOfSpy).toHaveBeenCalled(1);
  });
});

describe('omitControlledSettings', () => {
  it('omits config controlled settings', () => {
    getConfigSettings.mockReturnValue({ disablePaidFeatureAds: true });
    const settings = models.settings.init();

    const result = omitControlledSettings(settings)({ disablePaidFeatureAds: false });

    expect(result).toMatchObject({});
  });

  it('does not omit settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = omitControlledSettings(settings)({ disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('omits settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
    };
    const result = omitControlledSettings(settings)({ enableAnalytics: true });

    expect(result).toMatchObject({});
  });

  it('does not omit settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();
    const result = omitControlledSettings(settings)({ disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });
});

describe('overwriteControlledSettings', () => {
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

  it.skip('config control trumps (non-config) settings control', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: true });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: false,
    };

    const result = getControlledSettings(settings);

    expect(result).toMatchObject({ enableAnalytics: true });
  });
});
