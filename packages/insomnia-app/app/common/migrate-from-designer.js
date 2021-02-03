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
import type { Workspace } from '../models/workspace';
import type { Settings } from '../models/settings';
import { getDataDirectory } from './misc';
import fsx from 'fs-extra';

function getDesignerDBFilePath(modelType: string): string {
  // fetch using env-paths
  const designerDataDir = envPaths('Insomnia Designer', { suffix: '' }).data;
  // NOTE: Do not EVER change this. EVER!
  return fsPath.join(designerDataDir, `insomnia.${modelType}.db`);
}

async function loadDesignerDb(types: Array<string>): Promise<Object> {
  const designerDb = {};

  types.forEach(type => {
    designerDb[type] = []; // initialize each type to empty array
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

type MigrationOptions = {
  useDesignerSettings: boolean,
};

async function createCoreBackup(modelTypes: Array<string>) {
  console.log(`[db-merge] creating backup`);

  const coreDataDir = getDataDirectory();
  const backupDir = fsPath.join(coreDataDir, 'core-backup');
  await fsx.ensureDir(backupDir);

  // Copy db files
  const filesToCopy = modelTypes.map(modelType => `insomnia.${modelType}.db`);

  for (const entryName of filesToCopy) {
    const src = fsPath.join(coreDataDir, entryName);
    const dest = fsPath.join(backupDir, entryName);

    await fsx.copy(src, dest);
  }

  // Copy dirs
  const dirsToCopy = ['plugins', 'responses', 'version-control'];

  for (const entryName of dirsToCopy) {
    const src = fsPath.join(coreDataDir, entryName);
    const dest = fsPath.join(backupDir, entryName);

    await fsx.ensureDir(dest);
    await fsx.copy(src, dest);
  }

  console.log(`[db-merge] backup created at ${backupDir}`);
}

async function actuallyMigrate({ useDesignerSettings }: MigrationOptions) {
  const modelTypesToIgnore = [
    models.stats.type, // TODO: investigate further any implications that may invalidate collected stats
  ];
  // TODO: should models.oAuth2Token.type also be ignored?

  const modelTypesToMerge = difference(models.types(), modelTypesToIgnore);

  // Create core backup
  await createCoreBackup(modelTypesToIgnore);

  // Load designer database
  const designerDb: DBType = await loadDesignerDb(modelTypesToMerge, console.log);

  // Ensure user is not migrating an existing Insomnia Core repo
  const designerSettings: Settings = designerDb[models.settings.type].find();
  if (designerSettings.hasOwnProperty('hasPromptedToMigrateFromDesigner')) {
    console.log('[db-merge] cannot merge database');
    return;
  }

  // For each model, batch upsert entries into the Core database
  for (const modelType of modelTypesToMerge) {
    const entries = designerDb[modelType];

    // Decide how to merge settings
    if (modelType === models.settings.type) {
      if (useDesignerSettings) {
        console.log(`[db-merge] keeping settings from Insomnia Designer`);
        const coreSettings = await models.settings.getOrCreate();
        (entries[0]: Settings)._id = coreSettings._id;
      } else {
        console.log(`[db-merge] keeping settings from Insomnia Core`);
        continue;
      }
    }

    // For each workspace coming from Designer, mark workspace.scope as 'designer'
    if (modelType === models.workspace.type) {
      for (const workspace of entries) {
        (workspace: Workspace).scope = 'designer';
      }
    }

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
