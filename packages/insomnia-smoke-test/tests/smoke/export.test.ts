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

    // Step 1: Create a new project
    await projectPage.createProject(projectName, 'local');

    // Wait for empty project view
    await projectPage.waitForEmptyProjectView();

    // Step 2: Import multiple fixture files
    await projectPage.importMultipleFixtures(FIXTURE_FILES);

    // Verify collections were imported (scope to Files grid list)
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();

    // Step 3: Open Preferences > Data tab and export project
    const tempDir = dataPage.createTempExportDir();

    try {
      // Mock the save dialog to use our temp directory
      await dataPage.mockOpenDialogForDirectory(tempDir);

      // Open Data tab in Preferences
      await dataPage.openDataTab();

      // Click export project button
      await dataPage.clickExportProjectButton(projectName);

      // Select YAML format
      await dataPage.selectExportFormat('yaml');

      // Wait for export to complete (project-level export has no alert, wait for files)
      await dataPage.waitForExportFiles(tempDir, 2);

      // Close the settings modal
      await dataPage.closeSettingsModal();

      // Step 4: Compare exported files with fixtures
      const exportedFiles = dataPage.getExportedFiles(tempDir);

      // Should have exported 2 files (one for each collection)
      expect.soft(exportedFiles.length).toBe(2);

      // Build a map of collection name to fixture file for lookup
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };

      // Get exported file contents and compare with fixtures
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
      // Cleanup temp directory
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export all data from Preferences Data tab', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export All Data Test';

    // Step 1: Create a new project
    await projectPage.createProject(projectName, 'local');

    // Wait for empty project view
    await projectPage.waitForEmptyProjectView();

    // Step 2: Import multiple fixture files
    await projectPage.importMultipleFixtures(FIXTURE_FILES);

    // Verify collections were imported (scope to Files grid list)
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection B')).toBeVisible();

    // Step 3: Open Preferences > Data tab and export all data
    const tempDir = dataPage.createTempExportDir();

    try {
      // Mock the open dialog to use our temp directory
      await dataPage.mockOpenDialogForDirectory(tempDir);

      // Open Data tab in Preferences
      await dataPage.openDataTab();

      // Click export all data button
      await dataPage.clickExportAllDataButton();

      // Wait for export complete alert (Export all data shows alert)
      await dataPage.waitForExportCompleteAlert();

      // Close the settings modal
      await dataPage.closeSettingsModal();

      // Step 4: Compare exported files with fixtures
      const exportedFiles = dataPage.getExportedFiles(tempDir).filter(file => !file.includes('scratchpad'));

      // Should have exported 2 files (one for each collection)
      expect.soft(exportedFiles.length).toBe(2);

      // Build a map of collection name to fixture file for lookup
      const fixtureMap: Record<string, string> = {
        'Collection-A': FIXTURE_FILES[0],
        'Collection-B': FIXTURE_FILES[1],
      };

      // Get exported file contents and compare with fixtures
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
      // Cleanup temp directory
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace card dropdown', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Single Workspace Test';
    const fixtureFile = FIXTURE_FILES[0]; // Collection A

    // Step 1: Create a new project
    await projectPage.createProject(projectName, 'local');

    // Wait for empty project view
    await projectPage.waitForEmptyProjectView();

    // Step 2: Import a single fixture file
    await projectPage.importFixtureFromEmptyProject(fixtureFile);

    // After import, app redirects to workspace page, navigate back to project
    await workspacePage.waitForWorkspaceLoaded();
    await workspacePage.goBackToProject();

    // Verify collection was imported
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();

    // Step 3: Export workspace from workspace card dropdown
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-export.yaml');

    try {
      // Export the workspace using the workspace card dropdown
      await projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');

      // Wait for the export file to be created
      await dataPage.waitForExportFiles(tempDir, 1);

      // Step 4: Verify the exported file matches the fixture
      const exportedContent = dataPage.readExportedFile(exportFilePath);

      // Compare with fixture
      const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      // Cleanup temp directory
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export single workspace from workspace dropdown', async ({ app, page }) => {
    const projectPage = new ProjectPage(page, app);
    const workspacePage = new WorkspacePage(page, app);
    const dataPage = new DataPage(page, app);

    const projectName = 'Export Workspace Dropdown Test';
    const fixtureFile = FIXTURE_FILES[0]; // Collection A

    // Step 1: Create a new project
    await projectPage.createProject(projectName, 'local');

    // Wait for empty project view
    await projectPage.waitForEmptyProjectView();

    // Step 2: Import a single fixture file
    await projectPage.importFixtureFromEmptyProject(fixtureFile);

    // After import, app redirects to workspace page
    // This time we stay on the workspace page (don't navigate back to project)
    await workspacePage.waitForWorkspaceLoaded();

    // Step 3: Export workspace from workspace dropdown
    const tempDir = dataPage.createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-workspace-dropdown-export.yaml');

    try {
      // Export the workspace using the workspace dropdown
      await workspacePage.exportWorkspaceFromDropdown(exportFilePath, 'yaml');

      // Wait for the export file to be created
      await dataPage.waitForExportFiles(tempDir, 1);

      // Step 4: Verify the exported file matches the fixture
      const exportedContent = dataPage.readExportedFile(exportFilePath);

      // Compare with fixture
      const comparison = dataPage.compareWithFixture(exportedContent, fixtureFile);

      expect.soft(comparison.matches, `Exported file should match fixture ${fixtureFile}`).toBe(true);
    } finally {
      // Cleanup temp directory
      dataPage.cleanupExportDir(tempDir);
    }
  });
});
