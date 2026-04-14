import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';
import {
  cleanupExportDir,
  createTempExportDir,
  mockSaveDialogForFile,
  readExportedFile,
  waitForExportFiles,
} from '../../playwright/utils';

test.describe('Response Downloads', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const FIXTURE = 'response-download-collection.yaml';

  test('Can export raw response body', async ({ insomnia, app, page }) => {
    await insomnia.projectPage.importFixture(FIXTURE);
    await page.getByLabel('Request Collection').getByTestId('JSON Request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const tempDir = createTempExportDir();
    const exportPath = path.join(tempDir, 'response-raw.json');
    try {
      await mockSaveDialogForFile(app, exportPath);
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.getByRole('menuitem', { name: 'Export raw response' }).click();
      await waitForExportFiles(tempDir, 1);
      const content = readExportedFile(exportPath);
      expect.soft(content).toContain('"id"');
      expect.soft(content).toContain('"1"');
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export prettified JSON response', async ({ insomnia, app, page }) => {
    await insomnia.projectPage.importFixture(FIXTURE);
    await page.getByLabel('Request Collection').getByTestId('JSON Request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const tempDir = createTempExportDir();
    const exportPath = path.join(tempDir, 'response-pretty.json');
    try {
      await mockSaveDialogForFile(app, exportPath);
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.getByRole('menuitem', { name: 'Export prettified response' }).click();
      await waitForExportFiles(tempDir, 1);
      const content = readExportedFile(exportPath);
      const parsed = JSON.parse(content);
      expect.soft(parsed.id).toBe('1');
      expect.soft(content.length).toBeGreaterThan('{"id":"1"}'.length);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export HTTP debug file', async ({ insomnia, app, page }) => {
    await insomnia.projectPage.importFixture(FIXTURE);
    await page.getByLabel('Request Collection').getByTestId('JSON Request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const tempDir = createTempExportDir();
    const exportPath = path.join(tempDir, 'response-debug.txt');
    try {
      await mockSaveDialogForFile(app, exportPath);
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.getByRole('menuitem', { name: 'Export HTTP debug' }).click();
      await waitForExportFiles(tempDir, 1);
      const content = readExportedFile(exportPath);
      expect.soft(content).toContain('Content-Type');
      expect.soft(content).toContain('"id"');
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export raw large response body', async ({ insomnia, app, page }) => {
    await insomnia.projectPage.importFixture(FIXTURE);
    await page.getByLabel('Request Collection').getByTestId('Large JSON Request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const tempDir = createTempExportDir();
    const exportPath = path.join(tempDir, 'response-large.json');
    try {
      await mockSaveDialogForFile(app, exportPath);
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.getByRole('menuitem', { name: 'Export raw response' }).click();
      await waitForExportFiles(tempDir, 1, 30_000);
      const { size } = fs.statSync(exportPath);
      expect.soft(size).toBeGreaterThan(5 * 1024 * 1024);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Prettified export is disabled for large JSON response', async ({ insomnia, page }) => {
    await insomnia.projectPage.importFixture(FIXTURE);
    await page.getByLabel('Request Collection').getByTestId('Large JSON Request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    await page.getByRole('button', { name: 'Preview' }).click();
    const prettifyItem = page.getByRole('menuitem', { name: 'Export prettified response' });
    await expect.soft(prettifyItem).toContainText('must be <5MB');
  });
});
