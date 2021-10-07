import { mocked } from 'ts-jest/utils';

import * as models from '../../../models';
import { getConfigSettings as _getConfigSettings, getControlledValue, omitControlledSettings, overwriteControlledSettings } from '../settings';

jest.mock('../settings');
const getConfigSettings = mocked(_getConfigSettings);

describe('getControlledValue', () => {
  it('resolve conflicting value', () => {
    getConfigSettings.mockReturnValue({});
    const settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true, // this intionally conflicts with incognito mode
    };

    const controlledValue = getControlledValue(settings)(true, 'enableAnalytics');

    expect(controlledValue).toBe(false);
  });

  // TEST that once is never removed by mocking validate and ensuring it's only ever called once
});

describe('omitControlledSettings', () => {
  it('omits config controlled settings', () => {
    getConfigSettings.mockReturnValue({ hideUpsells: true });
    const settings = models.settings.init();

    const result = omitControlledSettings(settings)({ hideUpsells: false });

    expect(result).toMatchObject({});
  });

  it('does not omit settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = omitControlledSettings(settings)({ hideUpsells: true });

    expect(result).toMatchObject({ hideUpsells: true });
  });

  it('omits settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = {
      ...models.settings.init(),
      incognitoMode: true,
    };
    const result = omitControlledSettings(settings)({ enableAnalytics: true });

    expect(result).toMatchObject({});
  });

  it('does not omit settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();
    const result = omitControlledSettings(settings)({ hideUpsells: true });

    expect(result).toMatchObject({ hideUpsells: true });
  });
});

describe('overwriteControlledSettings', () => {
  it('overwrites config controlled settings', () => {
    getConfigSettings.mockReturnValue({ hideUpsells: true });
    const settings = models.settings.init();

    const result = overwriteControlledSettings(settings)({ hideUpsells: false });

    expect(result).toMatchObject({ hideUpsells: true });
  });

  it('does not overwrite settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = overwriteControlledSettings(settings)({ hideUpsells: true });

    expect(result).toMatchObject({ hideUpsells: true });
  });

  it('overwrites settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = {
      ...models.settings.init(),
      incognitoMode: true,
    };
    const result = overwriteControlledSettings(settings)({ enableAnalytics: true });

    expect(result).toMatchObject({ enableAnalytics: false });
  });

  it('does not overwrite settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();
    const result = overwriteControlledSettings(settings)({ hideUpsells: true });

    expect(result).toMatchObject({ hideUpsells: true });
  });
});
