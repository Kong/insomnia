import path from 'node:path';

import { expect } from '@playwright/test';

import { DataPage } from '../../pages/preferences/data';
import { ProjectPage } from '../../pages/project';
import { WorkspacePage } from '../../pages/workspace';
import { test } from '../../playwright/test';

test.describe('Export', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const FIXTURE_FILES = [
    'export/Collection-A-wrk_829522b5e8dc4f37b7529db150315cd4.yaml',
    'export/Collection-B-wrk_64f68b9501cf48c5b4281e28718b7d41.yaml',
  ];

  test('Can export project files from Preferences Data tab in YAML format', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Test Project';
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importMultipleFixtures(FIXTURE_FILES);
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();
    const tempDir = dataPage.createTempExportDir();

    try {
      await dataPage.mockOpenDialogForDirectory(tempDir);
      await dataPage.openDataTab();
      await dataPage.clickExportProjectButton(projectName);
      await dataPage.selectExportFormat('yaml');
      await dataPage.waitForExportFiles(tempDir, 2);
      await dataPage.closeSettingsModal();
      const exportedFiles = dataPage.getExportedFiles(tempDir);
      expect.soft(exportedFiles.length).toBe(2);
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };

      for (const exportedFile of exportedFiles) {
        const exportedContent = dataPage.readExportedFile(exportedFile);
        const fileName = path.basename(exportedFile);

        // Find the matching fixture file by collection name
        const collectionNameMatch = fileName.match(/^(Collection-[AB])/);
        expect.soft(collectionNameMatch, `File ${fileName} should match collection name pattern`).not.toBeNull();

        const collectionName = String(collectionNameMatch?.[1]);
        const fixtureFile = String(fixtureMap[collectionName]);
        expect.soft(fixtureFile, `Should find fixture for ${collectionName}`).toBeTruthy();

        // Compare with fixture
        const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

        expect.soft(comparison.matches, `Exported file ${fileName} should match fixture ${fixtureFile}`).toBe(true);
      }
    } finally {
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export all data from Preferences Data tab', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export All Data Test';
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importMultipleFixtures(FIXTURE_FILES);
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();
    const tempDir = dataPage.createTempExportDir();

    try {
      await dataPage.mockOpenDialogForDirectory(tempDir);
      await dataPage.openDataTab();
      await dataPage.clickExportAllDataButton();
      await dataPage.waitForExportCompleteAlert();
      await dataPage.closeSettingsModal();
      const exportedFiles = dataPage.getExportedFiles(tempDir).filter(file => !file.includes('scratchpad'));
      expect.soft(exportedFiles.length).toBe(2);
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };
      for (const exportedFile of exportedFiles) {
        const exportedContent = dataPage.readExportedFile(exportedFile);
        const fileName = path.basename(exportedFile);

        const collectionNameMatch = fileName.match(/^(Collection-[AB])/);
        expect.soft(collectionNameMatch, `File ${fileName} should match collection name pattern`).not.toBeNull();

        const collectionName = String(collectionNameMatch?.[1]);
        const fixtureFile = String(fixtureMap[collectionName]);
        expect.soft(fixtureFile, `Should find fixture for ${collectionName}`).toBeTruthy();
        const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

        expect.soft(comparison.matches, `Exported file ${fileName} should match fixture ${fixtureFile}`).toBe(true);
      }
    } finally {
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export project files from Preferences Data tab in HAR format', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Project HAR Test';

    await projectPage.createProject(projectName, 'local');

    await projectPage.waitForEmptyProjectView();

    await projectPage.importMultipleFixtures(FIXTURE_FILES);

    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();

    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, `${projectName}.har`);

    try {
      await dataPage.mockSaveDialogForFile(exportFilePath);

      await dataPage.openDataTab();

      await dataPage.clickExportProjectButton(projectName);

      await dataPage.selectExportFormat('har');
      await dataPage.waitForExportFiles(tempDir, 1);

      await dataPage.closeSettingsModal();

      const exportedContent = dataPage.readExportedFile(exportFilePath);

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
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace card dropdown', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Single Workspace Test';
    const fixtureFile = FIXTURE_FILES[0];
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importFixtureFromEmptyProject(fixtureFile);
    await workspacePage.waitForWorkspaceLoaded();
    await workspacePage.goBackToProject();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-export.yaml');

    try {
      await projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');
      await dataPage.waitForExportFiles(tempDir, 1);
      const exportedContent = dataPage.readExportedFile(exportFilePath);
      const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace page dropdown', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Workspace Page Dropdown Test';
    const fixtureFile = FIXTURE_FILES[0];
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importFixtureFromEmptyProject(fixtureFile);
    await workspacePage.waitForWorkspaceLoaded();
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-workspace-page-dropdown-export.yaml');

    try {
      await workspacePage.exportWorkspaceFromDropdown(exportFilePath, 'yaml');
      await dataPage.waitForExportFiles(tempDir, 1);
      const exportedContent = dataPage.readExportedFile(exportFilePath);
      const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace card dropdown in HAR format', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Single Workspace HAR Test';
    const fixtureFile = FIXTURE_FILES[0];
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importFixtureFromEmptyProject(fixtureFile);
    await workspacePage.waitForWorkspaceLoaded();
    await workspacePage.goBackToProject();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-export.har');

    try {
      await projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'har');
      await dataPage.waitForExportFiles(tempDir, 1);
      const exportedContent = dataPage.readExportedFile(exportFilePath);
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
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace page dropdown in HAR format', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Workspace Page Dropdown HAR Test';
    const fixtureFile = FIXTURE_FILES[0];
    await projectPage.createProject(projectName, 'local');
    await projectPage.waitForEmptyProjectView();
    await projectPage.importFixtureFromEmptyProject(fixtureFile);
    await workspacePage.waitForWorkspaceLoaded();
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-workspace-page-dropdown-export.har');

    try {
      await workspacePage.exportWorkspaceFromDropdown(exportFilePath, 'har');
      await dataPage.waitForExportFiles(tempDir, 1);
      const exportedContent = dataPage.readExportedFile(exportFilePath);
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
      dataPage.cleanupExportDir(tempDir);
    }
  });
});
