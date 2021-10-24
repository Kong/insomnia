import { mocked } from 'ts-jest/utils';

import { ConfigError, getConfigSettings as _getConfigSettings  } from '../../models/helpers/settings';
import { validateInsomniaConfig } from '../validate-insomnia-config';

jest.mock('../../models/helpers/settings');
const getConfigSettings = mocked(_getConfigSettings);

describe('validateInsomniaConfig', () => {
  it('should return error if there is a parse error', () => {
    // Arrange
    const errorReturn = {
      error: {
        syntaxError: new SyntaxError('mock syntax error'),
        fileContents: '{ "mock": ["insomnia", "config"] }',
        configPath: '/mock/insomnia/config/path',
      },
    };
    getConfigSettings.mockReturnValue(errorReturn);

    // Act
    const result = validateInsomniaConfig();

    // Assert
    expect(result.error?.title).toBe('Invalid Insomnia Config');
    expect(result.error?.message).toMatchSnapshot();
  });

  it('should return error if there is a config error', () => {
    // Arrange
    const errorReturn: ConfigError = {
      error: {
        errors: [],
        humanReadableErrors: [{
          message: 'message',
          path: 'path',
          suggestion: 'suggestion',
          context: { errorType: 'const' },
        }],
        insomniaConfig: '{ "mock": ["insomnia", "config"] }',
        configPath: '/mock/insomnia/config/path',
      },
    };
    getConfigSettings.mockReturnValue(errorReturn);

    // Act
    const result = validateInsomniaConfig();

    // Assert
    expect(result.error?.title).toBe('Invalid Insomnia Config');
    expect(result.error?.message).toMatchSnapshot();
  });

  it('should return error if there is an unexpected error', () => {
    // Arrange
    const errorReturn = {
      error: {
        errors: [],
        humanReadableErrors: [],
        insomniaConfig: '{ "mock": ["insomnia", "config"] }',
        configPath: '/mock/insomnia/config/path',
      },
    };
    getConfigSettings.mockReturnValue(errorReturn);

    // Act
    const result = validateInsomniaConfig();

    // Assert
    expect(result.error?.title).toBe('An unexpected error occured while parsing Insomnia Config');
    expect(result.error?.message).toMatchSnapshot();
  });

  it('should not return any errors', () => {
    // Arrange
    const validReturn = { enableAnalytics: true };
    getConfigSettings.mockReturnValue(validReturn);

    // Act
    const result = validateInsomniaConfig();

    // Assert
    expect(result.error).not.toBeDefined();
  });
});
