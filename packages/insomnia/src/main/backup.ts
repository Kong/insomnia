import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import { version } from '../../package.json';
import { assertPathWithinDir } from './safe-fs-write';

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
    const backupsDir = path.join(dataPath, 'backups');
    const versionPath = path.join(backupsDir, version);

    // `version` is renderer-supplied over IPC — a traversal sequence here
    // (e.g. `../../../../some/dir`) must never let this read/copy `.db`
    // files from outside the app's own backups directory.
    await assertPathWithinDir(backupsDir, versionPath);

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
