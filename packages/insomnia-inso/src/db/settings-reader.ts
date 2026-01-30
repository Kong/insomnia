import { stat } from 'node:fs/promises';
import path from 'node:path';

import NeDB from '@seald-io/nedb';
import type { Settings } from 'insomnia/src/models/settings';

import { getAppDataDir, getDefaultProductName } from '../util';

/**
 * Reads Settings directly from the local NeDB file.
 * This is a minimal reader that avoids importing from db/index.ts
 * to prevent circular dependencies.
 */
export const readLocalSettings = async (): Promise<Settings | null> => {
  try {
    const appDataDir = getAppDataDir(getDefaultProductName());
    const filePath = path.join(appDataDir, 'insomnia.Settings.db');

    // Check if file exists
    await stat(filePath);

    return new Promise(resolve => {
      const collection = new NeDB({
        autoload: true,
        filename: filePath,
        corruptAlertThreshold: 0.9,
      });

      collection.findOne({}, (err, doc) => {
        if (err || !doc) {
          resolve(null);
          return;
        }
        resolve(doc as Settings);
      });
    });
  } catch {
    return null;
  }
};
