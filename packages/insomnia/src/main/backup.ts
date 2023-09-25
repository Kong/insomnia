import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import appConfig from '../../config/config.json';
import { version } from '../../package.json';
import { getUpdatesBaseURL } from '../common/constants';
import * as models from '../models';
import { insomniaFetch } from './insomniaFetch';

export async function backupIfNewerVersionAvailable() {
  try {
    const settings = await models.settings.get();
    console.log('[main] Checking for newer version than ', version);
    const response = await insomniaFetch<{ url: string }>({
      method: 'GET',
      origin: getUpdatesBaseURL(),
      path: `/builds/check/mac?v=${version}&app=${appConfig.appId}&channel=${settings.updateChannel}`,
      sessionId: null,
    });
    if (response) {
      console.log('[main] Found newer version', response);
      backup();
      return;
    }
    console.log('[main] No newer version');
  } catch (err) {
    console.log('[main] Error checking for newer version', err);
  }
}

export async function backup() {
  try {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const versionPath = path.join(dataPath, 'backups', version);
    await mkdir(versionPath, { recursive: true });
    // skip if backup already exists at version path
    const backupFiles = await readdir(versionPath);
    if (backupFiles.length) {
      console.log('Backup found at:', versionPath);
      return;
    }
    const files = await readdir(dataPath);
    files.forEach(async (file: string) => {
      if (file.endsWith('.db')) {
        await copyFile(path.join(dataPath, file), path.join(versionPath, file));
      }
    });
    console.log('Exported backup to:', versionPath);
  } catch (err) {
    console.log('Error exporting backup:', err);
  }
}

export async function restoreBackup(version: string) {
  try {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const versionPath = path.join(dataPath, 'backups', version);
    const files = await readdir(versionPath);
    if (!files.length) {
      console.log('No backup found at:', versionPath);
      return;
    }
    files.forEach(async (file: string) => {
      if (file.endsWith('.db')) {
        await copyFile(path.join(versionPath, file), path.join(dataPath, file));
      }
    });
    console.log('Restored backup from:', versionPath);
  } catch (err) {
    console.log('Error restoring backup:', err);
  }
  electron.app.relaunch();
  electron.app.exit();
}
