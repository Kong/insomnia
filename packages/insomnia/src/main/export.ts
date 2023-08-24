import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import { version } from '../../package.json';

export async function exportAllWorkspaces() {
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
    console.log('Error exporting project backup:', err);
  }
}
