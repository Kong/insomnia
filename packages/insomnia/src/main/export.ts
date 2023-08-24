import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import { version } from '../../package.json';

export async function backup() {
  try {

    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const versionPath = path.join(dataPath, 'backups', version);
    await mkdir(versionPath, { recursive: true });
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
