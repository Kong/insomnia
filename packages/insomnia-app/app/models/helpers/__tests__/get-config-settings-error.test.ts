import fs from 'fs';

import { getConfigSettings } from '../settings';

describe('getConfigSettings error', () => {
  it('returns an error if validation result has errors', () => {
    // Arrange
    const invalidConfig = {
      insomniaConfig: '1.0.0',
      settings: {
        random: 'abcd',
      },
    };

    const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));
    const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = getConfigSettings();

    // Assert
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(consoleErrorMock).toHaveBeenCalledWith('invalid insomnia config', result.error);
    }

    // Cleanup
    readFileSyncSpy.mockRestore();
    consoleErrorMock.mockRestore();
  });
});
