import { expect } from '@playwright/test';
import { parse } from 'yaml';

import { DataPage } from '../../pages/preferences/data';
import { test } from '../../playwright/test';

test.describe('Export functionality', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Can export files from project', async ({ app, page }) => {
    const dataPage = new DataPage(page, app);
    const tempDir = dataPage.createTempExportDir();

    try {
      // Step 1: Create a new project
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByText('Local Vault').click();
      await page.locator('input[name="name"]').fill('Test Export Project');
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      // Step 2: Create a new collection (empty project shows different UI)
      await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
      // Rename the collection
      await page.getByTestId('workspace-context-dropdown').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.locator('input[name="name"]').fill('Test Collection');
      await page.getByRole('button', { name: 'Update' }).click();
      await page.locator('.app').press('Escape');

      // Set the request URL
      await page
        .getByTestId('request-pane')
        .getByTestId('OneLineEditor')
        .first()
        .locator('.CodeMirror textarea')
        .fill('https://httpbin.org/get');

      // Rename the request and wait for it to be visible
      await page.getByTestId('My first request').dblclick();
      await page.getByRole('textbox', { name: 'GET My first request' }).fill('Test Request');
      await page.locator('body').click();

      // Wait for the renamed request to appear in the sidebar
      await page.getByTestId('Test Request').waitFor({ state: 'visible' });

      // Step 4: Mock the dialog to return our temp directory
      await dataPage.mockOpenDialogForDirectory(tempDir);

      // Step 5: Open settings and go to Data tab
      await dataPage.openDataTab();

      // Step 6: Click export project button
      await dataPage.clickExportProjectButton('Test Export Project');

      // Step 7: Select Insomnia v5 format
      await dataPage.selectExportFormat('yaml');

      // Step 8: Wait for export by checking for exported files
      await expect.poll(() => dataPage.getExportedFiles(tempDir).length, { timeout: 10_000 }).toBeGreaterThan(0);

      // Step 9: Close the settings modal
      await dataPage.closeSettingsModal();

      // Step 10: Verify the exported files
      const exportedFiles = dataPage.getExportedFiles(tempDir);
      expect.soft(exportedFiles.length).toBeGreaterThan(0);

      // Find the YAML file
      const yamlFile = exportedFiles.find(f => f.endsWith('.yaml'));
      expect.soft(yamlFile).toBeDefined();

      const content = dataPage.readExportedFile(yamlFile!);

      // Option 1: Comprehensive fixture comparison
      const fixtureComparison = dataPage.compareWithFixture(content, 'fixtures/export/expected-basic-collection.yaml');
      if (!fixtureComparison.matches) {
        console.log('Fixture comparison failed. Differences:');
        console.log(fixtureComparison.differences);
        console.log('\nNormalized Actual:');
        console.log(fixtureComparison.normalizedActual);
        console.log('\nNormalized Expected:');
        console.log(fixtureComparison.normalizedExpected);
      }
      expect.soft(fixtureComparison.matches).toBe(true);

      // Option 2: Fallback to structure validation if fixture comparison fails
      if (!fixtureComparison.matches) {
        const parsed = parse(content);

        // Verify the export structure
        expect.soft(parsed.type).toBe('collection.insomnia.rest/5.0');
        expect.soft(parsed.name).toBe('Test Collection');
        expect.soft(parsed.collection).toBeDefined();
        expect.soft(Array.isArray(parsed.collection)).toBe(true);

        // Find the request in the collection
        const request = parsed.collection?.find((item: { name?: string }) => item.name === 'Test Request');
        expect.soft(request).toBeDefined();
        expect.soft(request?.method).toBe('GET');
        expect.soft(request?.url).toBe('https://httpbin.org/get');

        // Verify additional structure elements
        expect.soft(parsed.meta).toBeDefined();
        expect.soft(parsed.cookieJar).toBeDefined();
        expect.soft(parsed.environments).toBeDefined();
        expect.soft(parsed.schema_version).toBe('5.1');
      }
    } finally {
      // Cleanup
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Can export all data', async ({ app, page }) => {
    const dataPage = new DataPage(page, app);
    const tempDir = dataPage.createTempExportDir();

    try {
      // Step 1: Create first project and collection
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByText('Local Vault').click();
      await page.locator('input[name="name"]').fill('Export All Project 1');
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      // Create a collection in first project (empty project shows different UI)
      await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
      // Rename the collection
      await page.getByTestId('workspace-context-dropdown').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.locator('input[name="name"]').fill('Collection 1');
      await page.getByRole('button', { name: 'Update' }).click();
      await page.locator('.app').press('Escape');

      // Add a request and wait for it
      await page.getByLabel('Create in collection').click();
      await page.getByLabel('HTTP Request').click();
      await page
        .getByTestId('request-pane')
        .getByTestId('OneLineEditor')
        .first()
        .locator('.CodeMirror textarea')
        .fill('https://httpbin.org/get');
      await page.getByTestId('New Request').waitFor({ state: 'visible' });

      // Step 2: Create second project and collection
      await page.getByTestId('project').click();
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByText('Local Vault').click();
      await page.locator('input[name="name"]').fill('Export All Project 2');
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      // Create a collection in second project (empty project shows different UI)
      await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
      // Rename the collection
      await page.getByTestId('workspace-context-dropdown').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.locator('input[name="name"]').fill('Collection 2');
      await page.getByRole('button', { name: 'Update' }).click();
      await page.locator('.app').press('Escape');

      // Add a request
      await page.getByLabel('Create in collection').click();
      await page.getByLabel('HTTP Request').click();
      await page
        .getByTestId('request-pane')
        .getByTestId('OneLineEditor')
        .first()
        .locator('.CodeMirror textarea')
        .fill('https://httpbin.org/post');
      await page.getByLabel('Request Method').click();
      await page.getByRole('button', { name: 'POST' }).click();
      await page.getByTestId('New Request').waitFor({ state: 'visible' });

      // Step 3: Mock the dialog to return our temp directory
      await dataPage.mockOpenDialogForDirectory(tempDir);

      // Step 4: Open settings and go to Data tab
      await dataPage.openDataTab();

      // Step 5: Click export all data button
      await dataPage.clickExportAllDataButton();

      // Step 6: Wait for export complete alert
      await dataPage.waitForExportCompleteAlert();

      // Step 7: Close the settings modal
      await dataPage.closeSettingsModal();

      // Step 8: Verify the exported files
      const exportedFiles = dataPage.getExportedFiles(tempDir);

      // Should have exported multiple files (one for each collection)
      const yamlFiles = exportedFiles.filter(f => f.endsWith('.yaml'));
      expect.soft(yamlFiles.length).toBeGreaterThanOrEqual(2);

      // Verify each exported file has valid structure
      for (const yamlFile of yamlFiles) {
        const content = dataPage.readExportedFile(yamlFile);
        const parsed = parse(content);

        // Each export should have the correct type indicator
        expect.soft(parsed.type).toMatch(/\.insomnia\.rest\/5\.0$/);
        expect.soft(parsed.schema_version).toBeDefined();
        expect.soft(parsed.name).toBeDefined();
      }

      // Verify we have at least one of the expected collections exported
      const exportedNames = yamlFiles.map(f => {
        const content = dataPage.readExportedFile(f);
        const parsed = parse(content);
        return parsed.name as string;
      });

      // Check that at least one expected collection is in the exports
      const hasExpectedCollections = [
        exportedNames.includes('Collection 1'),
        exportedNames.includes('Collection 2'),
      ].some(Boolean);
      expect.soft(hasExpectedCollections).toBe(true);
    } finally {
      // Cleanup
      dataPage.cleanupExportDir(tempDir);
    }
  });

  test('Export maintains request details correctly', async ({ app, page }) => {
    const dataPage = new DataPage(page, app);
    const tempDir = dataPage.createTempExportDir();

    try {
      // Step 1: Create a project
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByText('Local Vault').click();
      await page.locator('input[name="name"]').fill('Detail Test Project');
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      // Step 2: Create a collection (empty project shows different UI)
      await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
      // Rename the collection
      await page.getByTestId('workspace-context-dropdown').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.locator('input[name="name"]').fill('Detail Test Collection');
      await page.getByRole('button', { name: 'Update' }).click();
      await page.locator('.app').press('Escape');

      // Step 3: Add a POST request with body
      await page.getByLabel('Create in collection').click();
      await page.getByLabel('HTTP Request').click();

      // Set method to POST
      await page.getByLabel('Request Method').click();
      await page.getByRole('button', { name: 'POST' }).click();

      // Set URL
      await page
        .getByTestId('request-pane')
        .getByTestId('OneLineEditor')
        .first()
        .locator('.CodeMirror textarea')
        .fill('https://httpbin.org/post');

      // Add a header
      await page.locator('[data-key="headers"]').click();
      await page.getByRole('button', { name: 'Add' }).click();
      await page.locator('[data-testid="CodeEditor"] .cm-line').first().click();
      await page.keyboard.type('Content-Type');
      await page.locator('[data-testid="CodeEditor"] .cm-line').nth(1).click();
      await page.keyboard.type('application/json');

      // Rename the request
      await page.getByTestId('New Request').dblclick();
      await page.getByRole('textbox', { name: 'POST New Request' }).fill('POST Request');
      await page.locator('body').click();

      // Wait for the renamed request to appear
      await page.getByTestId('POST Request').waitFor({ state: 'visible' });

      // Step 4: Mock the dialog and export
      await dataPage.mockOpenDialogForDirectory(tempDir);
      await dataPage.openDataTab();
      await dataPage.clickExportProjectButton('Detail Test Project');
      await dataPage.selectExportFormat('yaml');

      // Wait for export by checking for exported files
      await expect.poll(() => dataPage.getExportedFiles(tempDir).length, { timeout: 10_000 }).toBeGreaterThan(0);

      await dataPage.closeSettingsModal();

      // Step 5: Verify exported content
      const exportedFiles = dataPage.getExportedFiles(tempDir);
      const yamlFile = exportedFiles.find(f => f.endsWith('.yaml'));
      expect.soft(yamlFile).toBeDefined();

      const content = dataPage.readExportedFile(yamlFile!);
      const parsed = parse(content);

      // Verify complete export structure
      expect.soft(parsed.type).toBe('collection.insomnia.rest/5.0');
      expect.soft(parsed.name).toBe('Detail Test Collection');
      expect.soft(parsed.schema_version).toBe('5.1');
      expect.soft(parsed.meta).toBeDefined();
      expect.soft(parsed.cookieJar).toBeDefined();
      expect.soft(parsed.environments).toBeDefined();
      expect.soft(parsed.collection).toBeDefined();
      expect.soft(Array.isArray(parsed.collection)).toBe(true);

      // Find the POST request
      const request = parsed.collection?.find((item: { name?: string }) => item.name === 'POST Request');
      expect.soft(request).toBeDefined();
      expect.soft(request?.method).toBe('POST');
      expect.soft(request?.url).toBe('https://httpbin.org/post');

      // Verify complete request structure
      expect.soft(request?.headers).toBeDefined();
      expect.soft(Array.isArray(request?.headers)).toBe(true);
      expect.soft(request?.body).toBeDefined();
      expect.soft(request?.parameters).toBeDefined();
      expect.soft(request?.authentication).toBeDefined();
      expect.soft(request?.settings).toBeDefined();
      expect.soft(request?.meta).toBeDefined();

      // Verify headers were exported correctly
      const contentTypeHeader = request?.headers?.find(
        (h: { name: string }) => h.name.toLowerCase() === 'content-type',
      );
      expect.soft(contentTypeHeader?.value).toBe('application/json');
    } finally {
      dataPage.cleanupExportDir(tempDir);
    }
  });
});
