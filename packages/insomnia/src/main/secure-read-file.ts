import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import electron from 'electron';

import { invariant } from '~/utils/invariant';

import * as models from '../models/index';

export const isPathAllowed = (filePath: string, userAllowList: string[]) => {
  const allowList = getSecuredFolderAllowList(userAllowList);
  const securedPath = securePath(filePath);
  const isAllowed = allowList.some(f => path.resolve(f) !== '' && securedPath.startsWith(path.resolve(f)));
  return { isAllowed, securedPath };
};
const securePath = (filePath: string) => path.resolve(decodeURIComponent(filePath));
const getSecuredFolderAllowList = (userAllowList: string[]) => {
  const userDataPath = process.type === 'renderer' ? window.app.getPath('userData') : electron.app.getPath('userData');
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || userDataPath;
  // we use tmpdir for buildMultipart
  // we put the db in userData
  // the user can also specifiy other folders
  return [os.tmpdir(), userdataDirectory, ...userAllowList];
};
// For reading files specified by plugins, environment variables, and scripts which could come from an imported collection
export const secureReadFile = async (filePath: string): Promise<string> => {
  const settings = await models.settings.getOrCreate();
  const { isAllowed, securedPath } = isPathAllowed(filePath, settings.dataFolders);

  invariant(
    isAllowed,
    `Insomnia cannot access the file "${securedPath}". You must specify which directories Insomnia can access in Insomnia Preferences → Security`,
  );

  return fs.promises.readFile(securedPath, { encoding: 'utf8' });
};
// For reading files selected by the user via a file dialog
export const insecureReadFile = async (filePath: string): Promise<string> => {
  return fs.promises.readFile(securePath(filePath), { encoding: 'utf8' });
};
// One off - For reading files used for the request runner
export const insecureReadFileWithEncoding = async (
  filePath: string,
  options?: Parameters<typeof fs.promises.readFile>[1],
): Promise<string | Buffer> => {
  return fs.promises.readFile(securePath(filePath), options);
};
