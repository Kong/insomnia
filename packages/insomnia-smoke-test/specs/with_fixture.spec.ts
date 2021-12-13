import { test } from '@playwright/test';
import os from 'os';
import path from 'path';
import * as uuid from 'uuid';

import { loadFixture } from '../modules/fixtures';
const mainPath = path.resolve(__dirname, '..', '..', 'insomnia-app', 'build', 'main.min.js');
const executablePath = path.resolve(__dirname, '..', '..', 'insomnia-app', 'node_modules/.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const newPage = async ({ playwright, options }) => {
  const electronApp = await playwright._electron.launch({
    executablePath,
    args: [mainPath],
    env: {
      ...process.env,
      ...options,
      ELECTRON_ENABLE_LOGGING: 'true',
      PLAYWRIGHT: 'true',
    },
  });
  await electronApp.waitForEvent('window');
  const page = await electronApp.firstWindow();
  page.on('console', console.log);
  if (process.platform === 'win32') await page.reload();
  return { electronApp, page };
};
const sharedPathForMigrationTests = path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuid.v4()}`);
const designerPath = path.join(__dirname, '..', 'fixtures', 'basic-designer');

test('can migrate designer', async ({ playwright }) => {
  const options = { DESIGNER_DATA_PATH: designerPath, INSOMNIA_DATA_PATH: sharedPathForMigrationTests };
  const { page } = await newPage({ playwright, options });
  await page.click('text=Copy Workspaces');
  await page.click('text=Copy Plugins');
  await page.click('text=Copy Designer Application Settings');
  await page.click('text=Start Migration');
  await page.click('text=Migrated successfully!');
  await page.close();
});
test('can see migrated stuff', async ({ playwright }) => {
  const designerPath = path.join(__dirname, '..', 'fixtures', 'basic-designer');
  const options = { DESIGNER_DATA_PATH: designerPath, INSOMNIA_DATA_PATH: sharedPathForMigrationTests };
  const { page } = await newPage({ playwright, options });
  await page.click('text=Don\'t share usage analytics');
  await page.click('text=Skip');
  await page.click('text=BASIC-DESIGNER-FIXTURE');
});

test('can send requests', async ({ playwright }) => {
  const options = { INSOMNIA_DATA_PATH: path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuid.v4()}`) };
  const { page, electronApp } = await newPage({ playwright, options });
  await page.click('text=Don\'t share usage analytics');
  await page.click('text=Skip');
  await page.click('text=Create');

  const requestCollectionFixture = await loadFixture('insomnia-request-collection.yaml');
  await electronApp.evaluate(async ({ clipboard }, requestCollectionFixture) => {
    // This runs in the main Electron process, parameter here is always
    // the result of the require('electron') in the main app script.
    return clipboard.writeText(requestCollectionFixture);
  }, requestCollectionFixture);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=Smoke tests');
  await page.click('button:has-text("GETsend JSON request")');
  await page.click('text=http://127.0.0.1:4010/pets/1Send >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.csv request and shows rich response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.csvSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.xml request and shows raw response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.xmlSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.pdf request and shows rich response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.pdfSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends request with basic authentication")');
  await page.click('text=http://127.0.0.1:4010/auth/basicSend >> button');
  await page.click('text=200 OK');
});
