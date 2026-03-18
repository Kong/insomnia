import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import { services } from '~/insomnia-data';
import { getUpdateUrl } from '~/main/updates';

import { version } from '../../package.json';
import { getClientString } from '../common/constants';

export async function backupIfNewerVersionAvailable() {
  try {
    const settings = await services.settings.get();
    console.log('[main] Checking for newer version than', version);
    const url = getUpdateUrl(settings.updateChannel);
    if (!url) {
      console.log('[main] Update URL not found, skipping backup check');
      return;
    }
    const response = await electron.net.fetch(url, {
      method: 'GET',
      headers: new Headers({
        'X-Insomnia-Client': getClientString(),
      }),
    });
    if (response) {
      console.log('[main] Found newer version');
      await backup();
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
      console.log('[main] Backup found at:', versionPath);
      return;
    }
    const files = await readdir(dataPath);
    for (const file of files) {
      if (file.endsWith('.db')) {
        await copyFile(path.join(dataPath, file), path.join(versionPath, file));
      }
    }

    console.log('[main] Exported backup to:', versionPath);
  } catch (err) {
    console.log('[main] Error exporting backup:', err);
  }
}

export async function restoreBackup(version: string) {
  try {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const versionPath = path.join(dataPath, 'backups', version);
    const files = await readdir(versionPath);
    if (!files.length) {
      console.log('[main] No backup found at:', versionPath);
      return;
    }
    files.forEach(async (file: string) => {
      if (file.endsWith('.db')) {
        await copyFile(path.join(versionPath, file), path.join(dataPath, file));
      }
    });
    console.log('[main] Restored backup from:', versionPath);
  } catch (err) {
    console.log('[main] Error restoring backup:', err);
  }
  electron.app.relaunch();
  electron.app.exit();
}
