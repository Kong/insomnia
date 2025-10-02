import fs from 'node:fs';
import path from 'node:path';

import electron from 'electron';

import * as models from '../models/index';

export const secureReadFile = async (filePath: string, options?: Parameters<typeof fs.promises.readFile>[1]) => {
  const settings = await models.settings.getOrCreate();
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');
  const allowList = [process.cwd(), userdataDirectory, ...settings.dataFolders];
  const fullPath = path.resolve(filePath);
  const isAllowed = allowList.some(f => path.resolve(f) !== '' && fullPath.startsWith(path.resolve(f)));
  if (!isAllowed) {
    throw `Insomnia cannot access the file "${fullPath}". You must specify which directories Insomnia can access in Insomnia's Preferences → Security`;
  }

  return fs.promises.readFile(fullPath, options);
};

export const insecureReadFile = async (filePath: string, options?: Parameters<typeof fs.promises.readFile>[1]) => {
  return fs.promises.readFile(filePath, options);
};
