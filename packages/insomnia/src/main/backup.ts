import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';
import { services } from 'insomnia-data';

import { getUpdateUrl } from '~/main/updates';

import { version } from '../../package.json';
import { getClientString } from '../common/constants';
import { isPathInsideDir } from './ipc/path-guard';

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

// `version` comes from the renderer; it must name a single directory directly under `backups/`.
const resolveBackupVersionPath = (dataPath: string, version: string): string => {
  const backupsDir = path.join(dataPath, 'backups');
  const versionPath = path.resolve(backupsDir, version);
  if (
    typeof version !== 'string' ||
    !version ||
    version === '.' ||
    version === '..' ||
    /[/\\\0]/.test(version) ||
    path.dirname(versionPath) !== path.resolve(backupsDir) ||
    !isPathInsideDir(versionPath, backupsDir)
  ) {
    throw new Error('restoreBackup: invalid backup version');
  }
  return versionPath;
};

export async function restoreBackup(version: string) {
  const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
  const versionPath = resolveBackupVersionPath(dataPath, version);
  try {
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
