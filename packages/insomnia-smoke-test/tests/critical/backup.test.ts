import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can backup data on new version available', async ({ app, page }) => {
  const dataPath = await app.evaluate(async ({ app }) => app.getPath('userData'));
  await page.getByRole('button', { name: 'Create request collection' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText('Error: URL using bad/illegal').click();
  const rootBackupsFolder = fs.readdirSync(path.join(dataPath, 'backups'));
  const backupDir = fs.readdirSync(path.join(dataPath, 'backups', rootBackupsFolder[0]));
  const hasFilesInsideBackup = backupDir.length > 0;
  const hasProjectDbFile = backupDir.includes('insomnia.Project.db');
  expect.soft(hasFilesInsideBackup).toBe(true);
  expect.soft(hasProjectDbFile).toBe(true);
});
