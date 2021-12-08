import { test } from '@playwright/test';
import os from 'os';
import path from 'path';
import * as uuid from 'uuid';

import { loadFixture } from '../modules/fixtures';
import { insomniaTestFixture, runElectronApp } from './test';

const temporaryDataPath = path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuid.v4()}`);
test('can migrate designer', async ({ playwright }) => {
  const designerDataPath = path.join(__dirname, '..', 'fixtures', 'basic-designer');
  const options = { DESIGNER_DATA_PATH: designerDataPath, INSOMNIA_DATA_PATH: temporaryDataPath };
  const insomniaApp = await runElectronApp(playwright._electron, options);
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  page.on('console', console.log);
  await page.click('text=Copy Workspaces');
  await page.click('text=Copy Plugins');
  await page.click('text=Copy Designer Application Settings');
  await page.click('text=Start Migration');
  await page.click('text=Migrated successfully!');
  await page.close();
});
test('can see migrated stuff', async ({ playwright }) => {
  const designerDataPath = path.join(__dirname, '..', 'fixtures', 'basic-designer');
  const options = { DESIGNER_DATA_PATH: designerDataPath, INSOMNIA_DATA_PATH: temporaryDataPath };
  const insomniaApp = await runElectronApp(playwright._electron, options);
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  await page.click('text=Don\'t share usage analytics');
  await page.click('text=Skip');
  await page.click('text=BASIC-DESIGNER-FIXTURE');
});

insomniaTestFixture('can send requests', async ({ insomniaApp }) => {
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  await page.click('text=Don\'t share usage analytics');
  await page.click('text=Skip');
  await page.click('text=Create');

  const requestCollectionFixture = await loadFixture('insomnia-request-collection.yaml');
  await insomniaApp.evaluate(async ({ clipboard }, requestCollectionFixture) => {
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
