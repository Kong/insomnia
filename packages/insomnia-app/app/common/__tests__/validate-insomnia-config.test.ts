import electron from 'electron';
import { mocked } from 'ts-jest/utils';

import { getConfigSettings as _getConfigSettings  } from '../../models/helpers/settings';
import { validateInsomniaConfig } from '../validate-insomnia-config';

jest.mock('electron');
jest.mock('../models/helpers/settings');
const electronAppExit = mocked(electron.app.exit);
const electronShowErrorBox = mocked(electron.dialog.showErrorBox);
const getConfigSettings = mocked(_getConfigSettings);

describe('validateInsomniaConfig', () => {
  it('should show error box and exit if there is an error', () => {
    // Arrange
    const errorReturn = {
      error: {
        errors: [],
        insomniaConfig: 'abc',
        configPath: 'configPath',
      },
    };
    getConfigSettings.mockReturnValue(errorReturn);

    // Act
    validateInsomniaConfig();

    // Assert
    expect(electronShowErrorBox).toHaveBeenCalled();
    expect(electronAppExit).toHaveBeenCalled();
  });

  it('should not exit if there are no errors', () => {
    // Arrange
    const validReturn = { enableAnalytics: true };
    getConfigSettings.mockReturnValue(validReturn);

    // Act
    validateInsomniaConfig();

    // Assert
    expect(electronAppExit).not.toHaveBeenCalledWith();
  });
});
