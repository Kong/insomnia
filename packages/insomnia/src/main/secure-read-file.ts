import fs from 'node:fs';
import path from 'node:path';

import { throwError } from '../common/validators';
import * as models from '../models/index';

export const secureReadFile = async (
  filePath: string,
  options?: Parameters<typeof fs.promises.readFile>[1],
  overrideDataFolders?: string[],
) => {
  const settings = await models.settings.getOrCreate();
  const dataFolders = overrideDataFolders || settings?.dataFolders || [];

  if (dataFolders) {
    filePath = path.resolve(filePath);

    const allowed = dataFolders.some(allowedFolder => {
      const absAllowedFolder = path.resolve(allowedFolder);
      return absAllowedFolder !== '' && filePath?.startsWith(absAllowedFolder);
    });
    if (!allowed) {
      throw throwError(filePath, false)
    }
  }

  return fs.promises.readFile(filePath, options);
};
