import NeDB from 'nedb';
import type { BaseModel } from '../models';
import fsPath from 'path';
import fs from 'fs';
import * as models from '../models';
import { database as db } from './database';
import { getModelName } from '../models';
import { difference } from 'lodash';
import type { Settings } from '../models/settings';
import fsx from 'fs-extra';
import { trackEvent } from './analytics';
import { forceWorkspaceScopeToDesign } from '../sync/git/force-workspace-scope-to-design';

async function loadDesignerDb(
  types: string[],
  designerDataDir: string,
): Promise<Record<string, any>> {
  const designerDb = {};
  types.forEach(type => {
    designerDb[type] = []; // initialize each type to empty array
  });
  const promises = types.map(
    type =>
      new Promise<void>((resolve, reject) => {
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
        collection.find({}, (err, docs: BaseModel[]) => {
          if (err) {
            return reject(err);
          }

          (designerDb[type] as Record<string, any>[]).push(...docs);
          resolve();
        });
      }),
  );
  await Promise.all(promises);
  // Return entries, but no longer linked to the database files
  return designerDb;
}

type DBType = Record<string, BaseModel[]>;

export interface MigrationOptions {
  useDesignerSettings: boolean;
  copyPlugins: boolean;
  copyWorkspaces: boolean;
  designerDataDir: string;
  coreDataDir: string;
}

export interface MigrationResult {
  error?: Error;
}

async function createCoreBackup(modelTypes: string[], coreDataDir: string) {
  console.log('[db-merge] creating backup');
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
  return backupDir;
}

async function migratePlugins(designerDataDir: string, coreDataDir: string) {
  const designerPluginDir = fsPath.join(designerDataDir, 'plugins');
  const corePluginDir = fsPath.join(coreDataDir, 'plugins');
  // get list of plugins in Designer
  const designerPlugins = await readDirs(designerPluginDir);
  await removeDirs(designerPlugins, corePluginDir);
  await copyDirs(designerPlugins, designerPluginDir, corePluginDir);
  // Remove plugin bundle from installed plugins because it's included with the app now
  const pluginsToDelete = [
    'insomnia-plugin-kong-bundle',
    'insomnia-plugin-kong-declarative-config',
    'insomnia-plugin-kong-kubernetes-config',
    'insomnia-plugin-kong-portal',
  ];
  await removeDirs(pluginsToDelete, corePluginDir);
}

async function readDirs(srcDir: string) {
  if (existsAndIsDirectory(srcDir)) {
    return await fs.promises.readdir(srcDir);
  } else {
    return [];
  }
}

async function copyDirs(dirs: string[], srcDir: string, destDir: string) {
  for (const dir of dirs.filter(c => c)) {
    const src = fsPath.join(srcDir, dir);
    const dest = fsPath.join(destDir, dir);

    // If source exists, ensure the destination exists, and copy into it
    if (existsAndIsDirectory(src)) {
      await fsx.ensureDir(dest);
      await fsx.copy(src, dest);
    }
  }
}

async function removeDirs(dirs: string[], srcDir: string) {
  for (const dir of dirs.filter(c => c)) {
    const dirToRemove = fsPath.join(srcDir, dir);

    if (existsAndIsDirectory(dirToRemove)) {
      await fsx.remove(dirToRemove);
    }
  }
}

export function existsAndIsDirectory(name: string) {
  return fs.existsSync(name) && fs.statSync(name).isDirectory();
}

export default async function migrateFromDesigner({
  useDesignerSettings,
  designerDataDir,
  coreDataDir,
  copyPlugins,
  copyWorkspaces,
}: MigrationOptions) {
  console.log(
    `[db-merge] starting process for migrating from ${designerDataDir} to ${coreDataDir}`,
  );
  const nonWorkspaceModels = [
    models.stats.type, // TODO: investigate further any implications that may invalidate collected stats
    models.settings.type,
  ];
  // Every model except those to ignore and settings is a "workspace" model
  const workspaceModels = difference(models.types(), nonWorkspaceModels);
  const modelTypesToMerge = [];

  if (useDesignerSettings) {
    trackEvent('Data', 'Migration', 'Settings');
    // @ts-expect-error -- TSCONVERSION
    modelTypesToMerge.push(models.settings.type);
    console.log('[db-merge] keeping settings from Insomnia Designer');
  } else {
    console.log('[db-merge] keeping settings from Insomnia Core');
  }

  if (copyWorkspaces) {
    trackEvent('Data', 'Migration', 'Workspaces');
    // @ts-expect-error -- TSCONVERSION
    modelTypesToMerge.push(...workspaceModels);
  }

  let backupDir = '';

  try {
    // Create core backup
    backupDir = await createCoreBackup(modelTypesToMerge, coreDataDir);
    // Load designer database
    const designerDb: DBType = await loadDesignerDb(modelTypesToMerge, designerDataDir);

    // For each model, batch upsert entries into the Core database
    for (const modelType of modelTypesToMerge) {
      const entries = designerDb[modelType];

      // Persist some settings from core
      if (modelType === models.settings.type) {
        const coreSettings = await models.settings.getOrCreate();
        const propertiesToPersist = [
          '_id',
          'hasPromptedOnboarding',
          'hasPromptedToMigrateFromDesigner',
        ];
        propertiesToPersist.forEach(s => {
          if (coreSettings.hasOwnProperty(s)) {
            (entries[0] as Settings)[s] = coreSettings[s];
          }
        });
      }

      // For each workspace coming from Designer, mark workspace.scope as 'design'
      if (modelType === models.workspace.type) {
        entries.forEach(forceWorkspaceScopeToDesign);
      }

      const entryCount = entries.length;
      console.log(
        `[db-merge] merging ${entryCount} ${getModelName(modelType, entryCount)} from Designer`,
      );
      await db.batchModifyDocs({
        upsert: entries,
        remove: [],
      });
    }

    if (copyWorkspaces) {
      console.log('[db-merge] migrating version control data from designer to core');
      await copyDirs(['version-control'], designerDataDir, coreDataDir);
      console.log('[db-merge] migrating response cache from designer to core');
      await copyDirs(['responses'], designerDataDir, coreDataDir);
    }

    if (copyPlugins) {
      console.log('[db-merge] migrating plugins from designer to core');
      trackEvent('Data', 'Migration', 'Plugins');
      await migratePlugins(designerDataDir, coreDataDir);
    }

    console.log('[db-merge] done!');
    trackEvent('Data', 'Migration', 'Success');
    return {};
  } catch (error) {
    console.log('[db-merge] an error occurred while migrating');
    console.error(error);
    trackEvent('Data', 'Migration', 'Failure');
    await restoreCoreBackup(backupDir, coreDataDir);
    return {
      error,
    } as MigrationResult;
  }
}

export async function restoreCoreBackup(backupDir: string, coreDataDir: string) {
  if (!backupDir) {
    console.log('[db-merge] nothing to restore; no backup was created');
    return;
  }

  if (!existsAndIsDirectory(backupDir)) {
    console.log(`[db-merge] nothing to restore: backup directory doesn't exist at ${backupDir}`);
    return;
  }

  console.log('[db-merge] restoring from backup');
  await removeDirs(['plugins', 'responses', 'version-control'], coreDataDir);
  await fsx.copy(backupDir, coreDataDir);
  console.log('[db-merge] restored from backup');
}
