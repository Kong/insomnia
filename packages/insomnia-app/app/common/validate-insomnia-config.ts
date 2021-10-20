import electron from 'electron';
import { join } from 'path';

import { getConfigSettings } from '../models/helpers/settings';
import { exitApp } from './electron-helpers';

export const validateInsomniaConfig = () => {
  const configSettings = getConfigSettings();
  if ('error' in configSettings) {
    const errors = configSettings.error.humanErrors?.map(({ message, path, suggestion }, index) => ([
      `[Error ${index + 1}]`,
      `Path: ${join(path, 'insomnia.config.json')}`,
      `${message}.${suggestion ? `  ${suggestion}` : ''}`,
    ]).join('\n')).join('\n\n');

    electron.dialog.showErrorBox('Invalid Insomnia Config',
      [
        `Your Insomnia Config was found to be invalid.  Please check the path below for the following error${configSettings.error.humanErrors?.length > 1 ? 's' : ''}:`,
        '',
        '[Path]',
        configSettings.error.configPath,
        '',
        errors,
      ].join('\n'),
    );
    exitApp();
  }
};
