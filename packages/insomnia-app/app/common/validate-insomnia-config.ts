import { getConfigSettings, isConfigError, isParseError } from '../models/helpers/settings';

interface Result {
  error?:{
    title: string;
    message: string;
  };
}

export const validateInsomniaConfig = (): Result => {
  const configSettings = getConfigSettings();

  if (!('error' in configSettings)) {
    return {};
  }

  let title = 'Invalid Insomnia Config';
  let message = '';

  if (isParseError(configSettings)) {
    const { syntaxError, configPath } = configSettings.error;
    message = [
      'Failed to parse JSON file for Insomnia Config.',
      '',
      '[Path]',
      configPath,
      '',
      '[Syntax Error]',
      syntaxError.message,
    ].join('\n');
  } else if (isConfigError(configSettings)) {
    const { humanReadableErrors, configPath } = configSettings.error;
    const errors = humanReadableErrors.map(({ message, path, suggestion }, index) => ([
      `[Error ${index + 1}]`,
      `Path: ${path}`,
      `${message}.${suggestion ? `  ${suggestion}` : ''}`,
    ]).join('\n')).join('\n\n');

    message = [
      `Your Insomnia Config was found to be invalid.  Please check the path below for the following error${configSettings.error.humanReadableErrors?.length > 1 ? 's' : ''}:`,
      '',
      '[Path]',
      configPath,
      '',
      errors,
    ].join('\n');
  } else {
    title = 'An unexpected error occured while parsing Insomnia Config';
    message = JSON.stringify(configSettings);
  }

  return { error: { title, message } };
};
