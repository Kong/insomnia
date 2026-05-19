import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';
import {
  cleanupExportDir,
  compareWithFixture,
  createTempExportDir,
  getExportedFiles,
  readExportedFile,
  waitForExportFiles,
} from '../../playwright/utils';

test.describe('Export', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const FIXTURE_FILES = [
    'export/Collection-A-wrk_829522b5e8dc4f37b7529db150315cd4.yaml',
    'export/Collection-B-wrk_64f68b9501cf48c5b4281e28718b7d41.yaml',
  ];

  test('Can export project files from Preferences Data tab in YAML format', async ({ insomnia, page }) => {
    const projectName = 'Export Test Project';
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importMultipleFixtures(FIXTURE_FILES);
    await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection A')).toBeVisible();
    await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection B')).toBeVisible();
    const tempDir = createTempExportDir();

    try {
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Data');
      await insomnia.preferencesPage.dataTab.exportProjectData(tempDir, 'yaml');
      await waitForExportFiles(tempDir, 2);
      const exportedFiles = getExportedFiles(tempDir);
      expect.soft(exportedFiles).toHaveLength(2);
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };

      for (const exportedFile of exportedFiles) {
        const exportedContent = readExportedFile(exportedFile);
        const fileName = path.basename(exportedFile);

        // Find the matching fixture file by collection name
        const collectionNameMatch = fileName.match(/^(Collection-[AB])/);
        expect.soft(collectionNameMatch, `File ${fileName} should match collection name pattern`).not.toBeNull();

        const collectionName = String(collectionNameMatch?.[1]);
        const fixtureFile = String(fixtureMap[collectionName]);
        expect.soft(fixtureFile, `Should find fixture for ${collectionName}`).toBeTruthy();

        // Compare with fixture
        const comparison = compareWithFixture(exportedContent, fixtureFile);

        expect.soft(comparison.matches, `Exported file ${fileName} should match fixture ${fixtureFile}`).toBe(true);
      }
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export all data from Preferences Data tab', async ({ insomnia, page }) => {
    const projectName = 'Export All Data Test';
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importMultipleFixtures(FIXTURE_FILES);
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();
    const tempDir = createTempExportDir();

    try {
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Data');
      await insomnia.preferencesPage.dataTab.exportAllData(tempDir);
      await insomnia.preferencesPage.closePreferences();
      const exportedFiles = getExportedFiles(tempDir).filter((file: string) => !file.includes('scratchpad'));
      expect.soft(exportedFiles).toHaveLength(2);
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };
      for (const exportedFile of exportedFiles) {
        const exportedContent = readExportedFile(exportedFile);
        const fileName = path.basename(exportedFile);

        const collectionNameMatch = fileName.match(/^(Collection-[AB])/);
        expect.soft(collectionNameMatch, `File ${fileName} should match collection name pattern`).not.toBeNull();

        const collectionName = String(collectionNameMatch?.[1]);
        const fixtureFile = String(fixtureMap[collectionName]);
        expect.soft(fixtureFile, `Should find fixture for ${collectionName}`).toBeTruthy();
        const comparison = compareWithFixture(exportedContent, fixtureFile);

        expect.soft(comparison.matches, `Exported file ${fileName} should match fixture ${fixtureFile}`).toBe(true);
      }
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export project files from Preferences Data tab in HAR format', async ({ insomnia, page }) => {
    const projectName = 'Export Project HAR Test';

    await insomnia.projectPage.createProject(projectName, 'local');

    await insomnia.projectPage.importMultipleFixtures(FIXTURE_FILES);

    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, `${projectName}.har`);

    try {
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Data');

      await insomnia.preferencesPage.dataTab.exportProjectData(exportFilePath, 'har');
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);

      const har = JSON.parse(exportedContent);

      expect.soft(har.log, 'HAR should have log property').toBeDefined();
      expect.soft(har.log.version, 'HAR log should have version').toBeDefined();
      expect.soft(har.log.creator, 'HAR log should have creator').toBeDefined();
      expect.soft(Array.isArray(har.log.entries), 'HAR log should have entries array').toBe(true);

      expect
        .soft(har.log.entries.length, 'HAR should contain request entries from multiple workspaces')
        .toBeGreaterThan(0);
      const firstEntry = har.log.entries[0];
      expect.soft(firstEntry.request, 'HAR entry should have request').toBeDefined();
      expect.soft(firstEntry.request.method, 'HAR entry request should have method').toBeDefined();
      expect.soft(firstEntry.request.url, 'HAR entry request should have url').toBeDefined();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace card dropdown', async ({ insomnia, page }) => {
    const projectName = 'Export Single Workspace Test';
    const fixtureFile = FIXTURE_FILES[0];
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importFixture(fixtureFile);
    await insomnia.workspacePage.goBackToProject();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-export.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);
      const exportedContent = readExportedFile(exportFilePath);
      const comparison = compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace page dropdown', async ({ insomnia, page }) => {
    const projectName = 'Export Workspace Page Dropdown Test';
    const fixtureFile = FIXTURE_FILES[0];
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importFixture(fixtureFile);
    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-workspace-page-dropdown-export.yaml');

    try {
      await insomnia.workspacePage.exportWorkspaceFromDropdown(exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);
      const exportedContent = readExportedFile(exportFilePath);
      const comparison = compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace card dropdown in HAR format', async ({ insomnia, page }) => {
    const projectName = 'Export Single Workspace HAR Test';
    const fixtureFile = FIXTURE_FILES[0];
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importFixture(fixtureFile);
    await insomnia.workspacePage.goBackToProject();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-export.har');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'har');
      await waitForExportFiles(tempDir, 1);
      const exportedContent = readExportedFile(exportFilePath);
      const har = JSON.parse(exportedContent);
      expect.soft(har.log, 'HAR should have log property').toBeDefined();
      expect.soft(har.log.version, 'HAR log should have version').toBeDefined();
      expect.soft(har.log.creator, 'HAR log should have creator').toBeDefined();
      expect.soft(Array.isArray(har.log.entries), 'HAR log should have entries array').toBe(true);
      expect.soft(har.log.entries.length, 'HAR should contain at least one request entry').toBeGreaterThan(0);
      const firstEntry = har.log.entries[0];
      expect.soft(firstEntry.request, 'HAR entry should have request').toBeDefined();
      expect.soft(firstEntry.request.method, 'HAR entry request should have method').toBeDefined();
      expect.soft(firstEntry.request.url, 'HAR entry request should have url').toBeDefined();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace page dropdown in HAR format', async ({ insomnia, page }) => {
    const projectName = 'Export Workspace Page Dropdown HAR Test';
    const fixtureFile = FIXTURE_FILES[0];
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importFixture(fixtureFile);
    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-workspace-page-dropdown-export.har');

    try {
      await insomnia.workspacePage.exportWorkspaceFromDropdown(exportFilePath, 'har');
      await waitForExportFiles(tempDir, 1);
      const exportedContent = readExportedFile(exportFilePath);
      const har = JSON.parse(exportedContent);
      expect.soft(har.log, 'HAR should have log property').toBeDefined();
      expect.soft(har.log.version, 'HAR log should have version').toBeDefined();
      expect.soft(har.log.creator, 'HAR log should have creator').toBeDefined();
      expect.soft(Array.isArray(har.log.entries), 'HAR log should have entries array').toBe(true);
      expect.soft(har.log.entries.length, 'HAR should contain at least one request entry').toBeGreaterThan(0);
      const firstEntry = har.log.entries[0];
      expect.soft(firstEntry.request, 'HAR entry should have request').toBeDefined();
      expect.soft(firstEntry.request.method, 'HAR entry request should have method').toBeDefined();
      expect.soft(firstEntry.request.url, 'HAR entry request should have url').toBeDefined();
    } finally {
      cleanupExportDir(tempDir);
    }
  });
});
