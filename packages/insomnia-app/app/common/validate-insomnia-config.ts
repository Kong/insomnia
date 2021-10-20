import electron from 'electron';

import { getConfigSettings, isConfigError, isParseError } from '../models/helpers/settings';

export const validateInsomniaConfig = () => {
  const configSettings = getConfigSettings();

  if (!('error' in configSettings)) {
    return true;
  }

  if (isParseError(configSettings)) {
    const { syntaxError, configPath } = configSettings.error;
    electron.dialog.showErrorBox('Invalid Insomnia Config', [
      'Failed to parse JSON file for Insomnia Config.',
      '',
      '[Path]',
      configPath,
      '',
      '[Syntax Error]',
      syntaxError.message,
    ].join('\n'));
  } else if (isConfigError(configSettings)) {
    const { humanReadableErrors, configPath } = configSettings.error;
    const errors = humanReadableErrors.map(({ message, path, suggestion }, index) => ([
      `[Error ${index + 1}]`,
      `Path: ${path}`,
      `${message}.${suggestion ? `  ${suggestion}` : ''}`,
    ]).join('\n')).join('\n\n');

    electron.dialog.showErrorBox('Invalid Insomnia Config', [
      `Your Insomnia Config was found to be invalid.  Please check the path below for the following error${configSettings.error.humanReadableErrors?.length > 1 ? 's' : ''}:`,
      '',
      '[Path]',
      configPath,
      '',
      errors,
    ].join('\n'));
  } else {
    electron.dialog.showErrorBox(
      'An unexpected error occured while parsing Insomnia Config',
      JSON.stringify(configSettings),
    );
  }

  return false;
};
