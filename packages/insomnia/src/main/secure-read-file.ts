import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import electron from 'electron';

import * as models from '../models/index';

export const getSecuredFolderAllowList = (userAllowList: string[]) => {
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');
  // we use tmpdir for buildMultipart
  // we may not be using cwd but it seems reasonable to allow it
  // we put the db in userData
  // the user can also specifiy other folders
  return [os.tmpdir(), process.cwd(), userdataDirectory, ...userAllowList];
};
// For reading files specified by plugins, environment variables, and scripts
export const secureReadFile = async (filePath: string): Promise<string> => {
  const settings = await models.settings.getOrCreate();
  const allowList = getSecuredFolderAllowList(settings.dataFolders);
  const fullPath = path.resolve(filePath);
  const isAllowed = allowList.some(f => path.resolve(f) !== '' && fullPath.startsWith(path.resolve(f)));
  if (!isAllowed) {
    throw `Insomnia cannot access the file "${fullPath}". You must specify which directories Insomnia can access in Insomnia's Preferences → Security`;
  }

  return fs.promises.readFile(fullPath, { encoding: 'utf8' });
};
// For reading files selected by the user via a file dialog
export const insecureReadFile = async (filePath: string): Promise<string> => {
  return fs.promises.readFile(filePath, { encoding: 'utf8' });
};
// One off - For reading files used for the request runner
export const insecureReadFileWithEncoding = async (
  filePath: string,
  options?: Parameters<typeof fs.promises.readFile>[1],
): Promise<string | Buffer> => {
  return fs.promises.readFile(filePath, options);
};
