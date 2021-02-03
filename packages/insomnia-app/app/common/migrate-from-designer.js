// @flow
import NeDB from 'nedb';
import type { BaseModel } from '../models';
import fsPath from 'path';
import envPaths from 'env-paths';
import fs from 'fs';
import * as models from '../models';
import * as db from './database';
import { getModelName } from '../models';
import { difference } from 'lodash';
import { showAlert } from '../ui/components/modals';

function getDesignerDBFilePath(modelType: string): string {
  // fetch using env-paths
  const designerDataDir = envPaths('Insomnia Designer', { suffix: '' }).data;
  // NOTE: Do not EVER change this. EVER!
  return fsPath.join(designerDataDir, `insomnia.${modelType}.db`);
}

async function loadDesignerDb(types: Array<string>): Promise<Object> {
  const designerDb = {};

  types.forEach(type => {
    designerDb[type] = []; // initialize to empty array
  });

  const promises = types.map(
    type =>
      new Promise((resolve, reject) => {
        const filePath = getDesignerDBFilePath(type);
        if (!fs.existsSync(filePath)) {
          console.log(`[db] db file for ${type} not found: ${filePath}`);
          resolve();
        }

        // Load the data
        const collection = new NeDB({
          autoload: true,
          filename: filePath,
          corruptAlertThreshold: 0.9,
        });

        // Find every entry and store in memory
        collection.find({}, (err, docs: Array<BaseModel>) => {
          if (err) {
            return reject(err);
          }

          (designerDb[type]: Array<Object>).push(...docs);
          resolve();
        });
      }),
  );

  await Promise.all(promises);

  // Return entries, but no longer linked to the database files
  return designerDb;
}

type DBType = { [string]: Array<BaseModel> };

async function actuallyMigrate() {
  const modelTypesToIgnore = [
    models.settings.type, // TODO: user should be prompted about which settings to use - Core or Designer
    models.stats.type, // TODO: investigate further any implications that may invalidate collected stats
  ];

  const modelTypesToMerge = difference(models.types(), modelTypesToIgnore);

  // TODO: should models.oAuth2Token.type also be ignored?

  // Load designer database
  const designerDb: DBType = await loadDesignerDb(modelTypesToMerge, console.log);

  // For each model,, batch upsert entries into the Core database
  for (const modelType of modelTypesToMerge) {
    const entries = designerDb[modelType];
    const entryCount = entries.length;
    console.log(
      `[db-merge] merging ${entryCount} ${getModelName(modelType, entryCount)} from Designer`,
    );
    await db.batchModifyDocs({ upsert: entries, remove: [] });
  }
}

export default async function migrateFromDesigner() {
  // Store flag in settings
  const settings = await models.settings.getOrCreate();
  await models.settings.update(settings, { hasPromptedToMigrateFromDesigner: true });

  showAlert({
    title: 'Migrate from Designer',
    message: 'Would you like to import your data from Insomnia Designer?',
    addCancel: true,
    onConfirm: actuallyMigrate,
  });
}
