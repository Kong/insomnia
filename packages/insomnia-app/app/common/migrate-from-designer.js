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
import * as electron from 'electron';

async function loadDesignerDb(types: Array<string>, designerDataDir: string): Promise<Object> {
  const designerDb = {};

  types.forEach(type => {
    designerDb[type] = []; // initialize each type to empty array
  });

  const promises = types.map(
    type =>
      new Promise((resolve, reject) => {
        const filePath = fsPath.join(designerDataDir, `insomnia.${type}.db`);
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

export type MigrationOptions = {
  useDesignerSettings: boolean,
  copyPlugins: boolean,
  copyResponses: boolean,
  designerDataDir: string,
  coreDataDir: string,
};

async function createCoreBackup(modelTypes: Array<string>, coreDataDir: string) {
  console.log(`[db-merge] creating backup`);

  const backupDir = fsPath.join(coreDataDir, 'core-backup');
  await fsx.remove(backupDir);
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

  await copyDirs(dirsToCopy, coreDataDir, backupDir);

  console.log(`[db-merge] backup created at ${backupDir}`);
}

async function migratePlugins(designerDataDir: string, coreDataDir: string) {
  const designerPluginDir = fsPath.join(designerDataDir, 'plugins');
  const corePluginDir = fsPath.join(coreDataDir, 'plugins');

  // get list of plugins in Designer
  const designerPlugins = await fs.promises.readdir(designerPluginDir);

  await removeDirs(designerPlugins, corePluginDir);
  await copyDirs(designerPlugins, designerPluginDir, corePluginDir);
}

async function copyDirs(dirs: Array<string>, srcDir: string, destDir: string) {
  for (const dir of dirs.filter(c => c)) {
    const src = fsPath.join(srcDir, dir);
    const dest = fsPath.join(destDir, dir);

    await fsx.ensureDir(dest);
    await fsx.copy(src, dest);
  }
}

async function removeDirs(dirs: Array<string>, srcDir: string) {
  for (const dir of dirs.filter(c => c)) {
    await fsx.remove(fsPath.join(srcDir, dir));
  }
}

async function actuallyMigrate({
  useDesignerSettings,
  designerDataDir,
  coreDataDir,
  copyPlugins,
  copyResponses,
}: MigrationOptions) {
  const modelTypesToIgnore = [
    models.stats.type, // TODO: investigate further any implications that may invalidate collected stats
  ];
  // TODO: should models.oAuth2Token.type also be ignored?

  const modelTypesToMerge = difference(models.types(), modelTypesToIgnore);

  // Create core backup
  await createCoreBackup(modelTypesToMerge, coreDataDir);

  try {
    // Load designer database
    const designerDb: DBType = await loadDesignerDb(modelTypesToMerge, designerDataDir);

    // Ensure user is not migrating an existing Insomnia Core repo
    const designerSettings: Settings = designerDb[models.settings.type][0];
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
          (entries[0]: Settings).hasPromptedToMigrateFromDesigner =
            coreSettings.hasPromptedToMigrateFromDesigner;
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

    console.log(`[db-merge] migrating version control data from designer to core`);
    await copyDirs(['version-control'], designerDataDir, coreDataDir);

    if (copyResponses) {
      console.log(`[db-merge] migrating response cache from designer to core`);
      await copyDirs(['responses'], designerDataDir, coreDataDir);
    } else {
      console.log(`[db-merge] not migrating response cache`);
    }

    if (copyPlugins) {
      console.log(`[db-merge] migrating plugins from designer to core`);
      await migratePlugins(designerDataDir, coreDataDir);
    } else {
      console.log(`[db-merge] not migrating plugins`);
    }

    showAlert({
      title: 'Success',
      message: 'Your data from Designer was migrated into Core. The application will now restart.',
      okLabel: 'Restart',
      addCancel: false,
      onConfirm: () => {
        const { app } = electron.remote || electron;
        app.relaunch();
        app.exit();
      },
    });
  } catch (e) {
    console.log('[db-merge] an error occurred while migrating');
    console.error(e);
    showAlert({
      title: 'Something went wrong!',
      message: 'Your previous data will be restored and the application will restart.',
      okLabel: 'Restore from backup',
      addCancel: false,
      onConfirm: async () => {
        await restoreCoreBackup(coreDataDir);
      },
    });
  }
}

export async function restoreCoreBackup(coreDataDir: string) {
  const backupDir = fsPath.join(coreDataDir, 'core-backup');
  if (!fs.existsSync(backupDir)) {
    console.log(`[db-merge] backup directory doesn't exist; doing nothing`);
    return;
  }

  console.log(`[db-merge] restoring from backup`);
  await removeDirs(['plugins', 'responses', 'version-control'], coreDataDir);
  await fsx.copy(backupDir, coreDataDir);
  console.log(`[db-merge] restored from backup`);

  const { app } = electron.remote || electron;
  app.relaunch();
  app.exit();
}

export default async function migrateFromDesigner() {
  // Store flag in settings
  const settings = await models.settings.getOrCreate();
  await models.settings.update(settings, { hasPromptedToMigrateFromDesigner: true });

  showAlert({
    title: 'Migrate from Designer',
    message: 'Would you like to import your data from Insomnia Designer?',
    addCancel: true,
    onConfirm: () =>
      actuallyMigrate({
        useDesignerSettings: true,
        copyPlugins: true,
        copyResponses: true,
        designerDataDir: envPaths('Insomnia Designer', { suffix: '' }).data,
        coreDataDir: getDataDirectory(),
      }),
  });
}
