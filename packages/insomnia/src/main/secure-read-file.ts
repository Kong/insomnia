import fs from 'node:fs';
import path from 'node:path';

import * as models from '../models/index';

export const secureReadFile = async (
  filePath: string,
  options?: Parameters<typeof fs.promises.readFile>[1],
  overrideAllowList?: string[],
) => {
  const settings = await models.settings.getOrCreate();
  const allowList = overrideAllowList || settings?.dataFolders || [];
  const fullPath = path.resolve(filePath);
  const isAllowed = allowList.some(f => path.resolve(f) !== '' && fullPath.startsWith(path.resolve(f)));
  if (!isAllowed) {
    throw `Insomnia cannot access the file "${filePath}". You must specify which directories Insomnia can access in Insomnia's Preferences → Security`;
  }

  return fs.promises.readFile(filePath, options);
};
