import * as electron from 'electron';
import mkdirp from 'mkdirp';
import { join } from 'path';

import { version } from '../../package.json';

export function clickLink(href: string) {
  const { protocol } = new URL(href);
  if (protocol === 'http:' || protocol === 'https:') {
    // eslint-disable-next-line no-restricted-properties -- this is, other than tests, what _should be_ the one and only place in this project where this is called.
    electron.shell.openExternal(href);
  }
}

/**
 * This environment variable is added by electron-builder.
 * see: https://www.electron.build/configuration/nsis.html#portable\
 */
export const getPortableExecutableDir = () => process.env['PORTABLE_EXECUTABLE_DIR'];

export function getDataDirectory() {
  const { app } = process.type === 'renderer' ? window : electron;
  return process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');
}

export function getTempDir() {
  // NOTE: Using a fairly unique name here because "insomnia" is a common word
  const { app } = process.type === 'renderer' ? window : electron;
  const dir = join(app.getPath('temp'), `insomnia_${version}`);
  mkdirp.sync(dir);
  return dir;
}

/**
 * There's no option that prevents Electron from fetching spellcheck dictionaries from Chromium's CDN and passing a non-resolving URL is the only known way to prevent it from fetching.
 * see: https://github.com/electron/electron/issues/22995
 * On macOS the OS spellchecker is used and therefore we do not download any dictionary files.
 * This API is a no-op on macOS.
 */
export const disableSpellcheckerDownload = () => {
  electron.session.defaultSession.setSpellCheckerDictionaryDownloadURL(
    'https://00.00/'
  );
};
