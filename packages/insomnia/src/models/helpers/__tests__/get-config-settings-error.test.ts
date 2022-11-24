import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';

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

    const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation();

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
