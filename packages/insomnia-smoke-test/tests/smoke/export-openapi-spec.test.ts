import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';
import {
  cleanupExportDir,
  createTempExportDir,
  mockSaveDialogForFile,
  readExportedFile,
  waitForExportFiles,
} from '../../playwright/utils';

test.describe('Export OpenAPI Spec', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Creates an API collection and fills its spec with the Pet Store example
  const createApiCollectionWithPetStoreSpec = async (page: Page) => {
    await page.getByRole('button', { name: 'Create document' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await page.click('text=Use example');
    await page.click('text=Pet Store');
    await expect.soft(page.locator('.pane-one').getByTestId('CodeEditor')).toContainText('openapi: 3.0.4');
  };

  test('exports the spec of an API collection as YAML from the sidebar dropdown', async ({ page, app, insomnia }) => {
    await createApiCollectionWithPetStoreSpec(page);

    const tempDir = createTempExportDir();
    try {
      const exportPath = path.join(tempDir, 'spec-export.yaml');
      await mockSaveDialogForFile(app, exportPath);

      await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
        actionName: 'Export OpenAPI Spec',
        workspaceName: 'My API Collection',
      });

      // The format modal defaults to YAML
      await insomnia.exportModal.selectExportFormat('yaml');

      await waitForExportFiles(tempDir, 1);
      const contents = readExportedFile(exportPath);
      expect.soft(contents).toContain('openapi: 3.0.4');
      expect.soft(contents).toContain('Pet Store');
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('exports the spec of an API collection as JSON from the sidebar dropdown', async ({ page, app, insomnia }) => {
    await createApiCollectionWithPetStoreSpec(page);

    const tempDir = createTempExportDir();
    try {
      const exportPath = path.join(tempDir, 'spec-export.json');
      await mockSaveDialogForFile(app, exportPath);

      await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
        actionName: 'Export OpenAPI Spec',
        workspaceName: 'My API Collection',
      });
      await insomnia.exportModal.selectExportFormat('json');

      await waitForExportFiles(tempDir, 1);
      const contents = JSON.parse(readExportedFile(exportPath));
      expect.soft(contents).toMatchObject({ openapi: '3.0.4' });
      expect.soft(contents.info.title).toContain('Pet');
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  test('offers Export OpenAPI Spec when the API collection is opened via right-click', async ({ page, insomnia }) => {
    await createApiCollectionWithPetStoreSpec(page);

    // Right-click opens the dropdown via the controlled isOpen prop, not the trigger
    await insomnia.navigationSidebar.workspaceRow('My API Collection').click({ button: 'right' });
    await expect.soft(page.getByRole('menuitemradio', { name: 'Export OpenAPI Spec' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('prompts an error while the spec is empty, then exports once it is filled in', async ({
    page,
    app,
    insomnia,
  }) => {
    await page.getByRole('button', { name: 'Create document' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    // Empty spec: the item is offered, but clicking it explains there is nothing to export
    // instead of writing an empty file.
    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My API Collection');
    await page.getByRole('menuitemradio', { name: 'Export OpenAPI Spec' }).click();
    await expect.soft(page.getByText('does not contain an OpenAPI specification to export')).toBeVisible();
    await page.getByRole('button', { name: 'Modal Close Button' }).click();

    // Fill the spec in: the same entry point now exports the file
    const tempDir = createTempExportDir();
    try {
      const exportPath = path.join(tempDir, 'spec-export.yaml');
      await mockSaveDialogForFile(app, exportPath);

      await page.click('text=Use example');
      await page.click('text=Pet Store');
      await expect.soft(page.locator('.pane-one').getByTestId('CodeEditor')).toContainText('openapi: 3.0.4');

      await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
        actionName: 'Export OpenAPI Spec',
        workspaceName: 'My API Collection',
      });
      await insomnia.exportModal.selectExportFormat('yaml');

      await waitForExportFiles(tempDir, 1);
      expect.soft(readExportedFile(exportPath)).toContain('openapi: 3.0.4');
    } finally {
      cleanupExportDir(tempDir);
    }
  });
});
