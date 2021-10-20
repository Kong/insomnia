import fs from 'fs';

import { getConfigSettings } from '../settings';

// This test exists outside of settings.test.ts because we need an unmocked `../settings` module
describe('getConfigSettings once', () => {
  it('only reads the config once on startup and then never again', () => {
    // Arrange
    const configOne = {
      insomniaConfig: '1.0.0',
      settings: {
        enableAnalytics: true,
      },
    };
    const configTwo = {
      insomniaConfig: '1.0.0',
      settings: {
        incognitoMode: true,
      },
    };

    const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(configOne));

    // Act
    const settingsFirstLoad = getConfigSettings();

    // Assert
    expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(settingsFirstLoad).toStrictEqual(configOne.settings);

    // Re arrange
    readFileSyncSpy.mockClear();
    readFileSyncSpy.mockReturnValue(JSON.stringify(configTwo));

    // Act
    const settingsSecondLoad = getConfigSettings();

    // Assert: make sure we don't read from the file again and get the first settings back
    expect(readFileSyncSpy).not.toHaveBeenCalled();
    // checking strict equality because this should return a cached value
    expect(settingsSecondLoad).toBe(settingsFirstLoad);

    // Cleanup
    readFileSyncSpy.mockRestore();
  });
});
