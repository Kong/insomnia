import electron from 'electron';
import { omit } from 'ramda';

import { getConfigSettings } from '../models/helpers/settings';
import { exitApp } from './electron-helpers';

export const validateInsomniaConfig = () => {
  const configSettings = getConfigSettings();
  if ('error' in configSettings) {
    const errors = configSettings.error.errors?.map(omit(['parentSchema', 'data']));

    electron.dialog.showErrorBox('Invalid Insomnia Config',
      [
        `Invalid Insomnia Config found at "${configSettings.error.configPath}"`,
        '',
        'errors:',
        `${JSON.stringify(errors, null, 2)}`,
      ].join('\n'),
    );

    exitApp();
  }
};
