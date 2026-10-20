import path from 'node:path';

import { type ElectronApplication, expect, type Page } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { copyFixtureDatabase } from '../../playwright/paths';
import { test } from '../../playwright/test';
import {
  cleanupExportDir,
  compareWithFixture,
  createTempExportDir,
  getExportedFiles,
  mockOpenDialogForDirectory,
  mockSaveDialogForFile,
  readExportedFile,
  waitForExportFiles,
} from '../../playwright/utils';

test.describe('Export', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  /** Selects a seeded fixture project and waits for the workspace card to render. */
  const openFixtureProject = async (
    insomnia: InsomniaApp,
    page: Page,
    projectName: string,
    workspaceName: string,
  ) => {
    await insomnia.navigationSidebar.selectProject(projectName);
    await insomnia.projectPage.waitForProjectDashboard();
    await expect.soft(page.getByLabel('Files').getByLabel(workspaceName)).toBeVisible();
  };

  /** Exports mock-server, environment and mcp workspaces, which bypass the export modal. */
  const exportWorkspaceDirectly = async ({
    insomnia,
    app,
    page,
    workspaceName,
    exportPath,
  }: {
    insomnia: InsomniaApp;
    app: ElectronApplication;
    page: Page;
    workspaceName: string;
    exportPath: string;
  }) => {
    await mockSaveDialogForFile(app, exportPath);
    await insomnia.projectPage.workspaceList.openWorkspaceCardDropdown(workspaceName);
    await page.getByRole('menuitem', { name: 'Export', exact: true }).click();
  };

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

  test('Can export project files from the sidebar project dropdown in YAML format', async ({ insomnia, page }) => {
    const projectName = 'Export Sidebar Project Test';
    await insomnia.projectPage.createProject(projectName, 'local');
    await insomnia.projectPage.importMultipleFixtures(FIXTURE_FILES);
    await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection A')).toBeVisible();
    await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection B')).toBeVisible();
    const tempDir = createTempExportDir();

    try {
      await insomnia.projectPage.exportProjectFromSidebar(projectName, tempDir, 'yaml');
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
      await insomnia.workspacePage.exportWorkspaceFromDropdown('Collection A', exportFilePath, 'yaml');
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
      await insomnia.workspacePage.exportWorkspaceFromDropdown('Collection A', exportFilePath, 'har');
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

  // Seeds the app database with a collection whose Request A holds a null authentication —
  // a shape old versions and plugins write, and the v5 schema rejects for requests. No UI
  // flow can produce it, so it is baked into the fixture database instead.
  const testWithPartialExportDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-partial-db', dataPath);
      await use(dataPath);
    },
  });

  const testWithAllBrokenExportDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-all-broken-db', dataPath);
      await use(dataPath);
    },
  });

  testWithPartialExportDb('Exports the requests that pass validation and reports the ones that do not', async ({
    insomnia,
    page,
  }) => {
    await insomnia.navigationSidebar.selectProject('Export Partial Fixture');
    await insomnia.projectPage.waitForProjectDashboard();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-partial-export.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);
      expect.soft(exportedContent).toContain('name: Request B');
      expect.soft(exportedContent).not.toContain('name: Request A');

      await expect.soft(page.getByText('Export completed with 1 skipped entity')).toBeVisible();
      await expect.soft(page.getByText('Request A (Request)')).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  testWithAllBrokenExportDb('Writes no file and reports the failure when nothing can be exported', async ({
    insomnia,
    page,
  }) => {
    await insomnia.navigationSidebar.selectProject('Export Partial Fixture');
    await insomnia.projectPage.waitForProjectDashboard();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection A')).toBeVisible();

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-empty-export.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');

      await expect.soft(page.getByText('export failed, no file was written')).toBeVisible();
      await expect.soft(page.getByText('Request A (Request)')).toBeVisible();
      expect.soft(getExportedFiles(tempDir)).toHaveLength(0);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithFolderPartialDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-folder-partial-db', dataPath);
      await use(dataPath);
    },
  });

  testWithFolderPartialDb('Keeps a folder and its healthy children when a child fails validation', async ({
    insomnia,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Folder Fixture', 'Collection A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-folder-partial.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);
      expect.soft(exportedContent).toContain('name: Folder');
      expect.soft(exportedContent).toContain('name: Healthy Child');
      expect.soft(exportedContent).not.toContain('name: Broken Child');

      await expect.soft(page.getByText('Export completed with 1 skipped entity')).toBeVisible();
      await expect.soft(page.getByText(/Broken Child \(Request\)/)).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithSectionBrokenDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-section-broken-db', dataPath);
      await use(dataPath);
    },
  });

  testWithSectionBrokenDb('Drops a broken environment section and still exports requests', async ({
    insomnia,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Section Fixture', 'Collection A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-broken-environment.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Collection A', exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);
      expect.soft(exportedContent).toContain('name: Healthy Request');
      expect.soft(exportedContent).not.toContain('environments:');

      await expect.soft(page.getByText(/Base Environment \(Environment\)/)).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithDesignPartialDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-design-partial-db', dataPath);
      await use(dataPath);
    },
  });

  testWithDesignPartialDb('Exports the healthy requests of a design document', async ({ insomnia, page }) => {
    await openFixtureProject(insomnia, page, 'Export Design Fixture', 'Design A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Design-A-partial.yaml');

    try {
      await insomnia.projectPage.exportWorkspaceFromCard('Design A', exportFilePath, 'yaml');
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);
      expect.soft(exportedContent).toContain('spec:');
      expect.soft(exportedContent).toContain('name: Healthy Request');
      expect.soft(exportedContent).not.toContain('name: Broken Request');

      await expect.soft(page.getByText(/Broken Request \(Request\)/)).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithMockPartialDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-mock-partial-db', dataPath);
      await use(dataPath);
    },
  });

  testWithMockPartialDb('Exports the routes that pass validation and reports the ones that do not', async ({
    insomnia,
    app,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Mock Fixture', 'Mock A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Mock-A-partial.yaml');

    try {
      await exportWorkspaceDirectly({ insomnia, app, page, workspaceName: 'Mock A', exportPath: exportFilePath });
      await waitForExportFiles(tempDir, 1);

      const exportedContent = readExportedFile(exportFilePath);
      expect.soft(exportedContent).toContain('name: /ok');
      expect.soft(exportedContent).not.toContain('/broken');

      await expect.soft(page.getByText(/\/broken \(MockRoute\)/)).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithMcpBrokenDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-mcp-broken-db', dataPath);
      await use(dataPath);
    },
  });

  testWithMcpBrokenDb('Writes no file when the MCP request cannot be exported', async ({ insomnia, app, page }) => {
    await openFixtureProject(insomnia, page, 'Export MCP Fixture', 'MCP A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'MCP-A-broken.yaml');

    try {
      await exportWorkspaceDirectly({ insomnia, app, page, workspaceName: 'MCP A', exportPath: exportFilePath });

      await expect.soft(page.getByText('export failed, no file was written')).toBeVisible();
      await expect.soft(page.getByText(/MCP A \(McpRequest\)/)).toBeVisible();
      expect.soft(getExportedFiles(tempDir)).toHaveLength(0);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithEnvironmentBrokenDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-environment-broken-db', dataPath);
      await use(dataPath);
    },
  });

  testWithEnvironmentBrokenDb('Writes no file when the environment cannot be exported', async ({
    insomnia,
    app,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Environment Fixture', 'Environment A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Environment-A-broken.yaml');

    try {
      await exportWorkspaceDirectly({
        insomnia,
        app,
        page,
        workspaceName: 'Environment A',
        exportPath: exportFilePath,
      });

      await expect.soft(page.getByText('export failed, no file was written')).toBeVisible();
      await expect.soft(page.getByText(/Base Environment \(Environment\)/)).toBeVisible();
      expect.soft(getExportedFiles(tempDir)).toHaveLength(0);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  const testWithMixedDb = test.extend({
    dataPath: async ({ dataPath }, use) => {
      await copyFixtureDatabase('export-mixed-db', dataPath);
      await use(dataPath);
    },
  });

  testWithMixedDb('Reports skipped entities once when exporting all data', async ({ insomnia, app, page }) => {
    await insomnia.navigationSidebar.selectProject('Export Mixed Fixture');
    await insomnia.projectPage.waitForProjectDashboard();
    const filesGrid = page.getByLabel('Files');
    await expect.soft(filesGrid.getByLabel('Collection Healthy')).toBeVisible();
    await expect.soft(filesGrid.getByLabel('Collection Partial')).toBeVisible();

    const tempDir = createTempExportDir();

    try {
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Data');
      await mockOpenDialogForDirectory(app, tempDir);
      await page.getByRole('button', { name: /Export all data/ }).click();

      const dialog = page.getByRole('dialog').filter({ hasText: 'Export Finished With Skipped Data' });
      await expect.soft(dialog).toBeVisible();
      await expect.soft(page.getByText('Export completed with 1 skipped entity')).toBeVisible();
      await expect.soft(page.getByText(/Collection Partial: Broken Request \(Request\)/)).toBeVisible();

      await dialog.getByRole('button', { name: 'Ok', exact: true }).click();
      await waitForExportFiles(tempDir, 3);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  testWithPartialExportDb('Refuses to duplicate a workspace that cannot be exported completely', async ({
    insomnia,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Partial Fixture', 'Collection A');

    await insomnia.projectPage.workspaceList.openWorkspaceCardDropdown('Collection A');
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="name"]').fill('Collection A copy');
    await dialog.getByRole('button', { name: 'Duplicate' }).click();

    await expect
      .soft(dialog.getByText(/Failed to duplicate workspace:.*workspace export failed schema validation/))
      .toBeVisible();
    await expect.soft(dialog.getByText(/Request A \(Request\)/)).toBeVisible();
  });

  testWithPartialExportDb('Writes no file when every selected request cannot be exported', async ({
    insomnia,
    app,
    page,
  }) => {
    await openFixtureProject(insomnia, page, 'Export Partial Fixture', 'Collection A');

    const tempDir = createTempExportDir();
    const exportFilePath = path.join(tempDir, 'Collection-A-selected-broken.yaml');

    try {
      await mockSaveDialogForFile(app, exportFilePath);
      await insomnia.projectPage.workspaceList.openWorkspaceCardDropdown('Collection A');
      await page.getByRole('menuitem', { name: 'Export', exact: true }).click();

      const dialog = page.getByRole('dialog');
      // Keep only Request A, whose authentication is rejected by the v5 schema.
      await dialog.getByRole('checkbox', { name: 'Request B' }).press('Space');
      await dialog.getByRole('button', { name: 'Export' }).click();
      await insomnia.exportModal.selectExportFormat('yaml');

      await expect.soft(page.getByText('export failed, no file was written')).toBeVisible();
      await expect.soft(page.getByText(/Request A \(Request\)/)).toBeVisible();
      expect.soft(getExportedFiles(tempDir)).toHaveLength(0);
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  testWithMixedDb('Writes the partial project export and reports skipped entities', async ({ insomnia, app, page }) => {
    await insomnia.navigationSidebar.selectProject('Export Mixed Fixture');
    await insomnia.projectPage.waitForProjectDashboard();

    const tempDir = createTempExportDir();

    try {
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Data');
      await insomnia.preferencesPage.dataTab.exportProjectData(tempDir, 'yaml');
      await waitForExportFiles(tempDir, 2);

      const files = getExportedFiles(tempDir);
      const healthyFile = files.find(file => file.includes('Collection-Healthy'));
      const partialFile = files.find(file => file.includes('Collection-Partial'));
      expect.soft(healthyFile).toBeTruthy();
      expect.soft(partialFile).toBeTruthy();

      const partialContent = readExportedFile(String(partialFile));
      expect.soft(partialContent).toContain('name: Healthy Request');
      expect.soft(partialContent).not.toContain('name: Broken Request');

      await expect.soft(page.getByText('Export completed with 1 skipped entity')).toBeVisible();
      await expect.soft(page.getByText(/Collection Partial: Broken Request \(Request\)/)).toBeVisible();
    } finally {
      cleanupExportDir(tempDir);
    }
  });
});

