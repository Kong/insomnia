import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"] >> text=Insomnia');
    await page.click('text=Create');
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
    await page.click('div[role="dialog"] button:has-text("New")');
    await page.click('text=Collectionsimplejust now');
  });

  test.describe('Interact with sidebar', async () => {
    test('Open Properties of an HTTP Request', async ({ page }) => {
      await page.locator('button:has-text("example http")').click();
      await page.locator('[data-testid="Dropdown-example-http"]').click();
      await page.locator('[data-testid="DropdownItemSettings-example-http"]').click();
      await expect(page.locator('.app')).toContainText('Request Settings req');
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a grpc request', async ({ page }) => {
      await page.locator('button:has-text("example grpc")').click();
      await page.locator('[data-testid="Dropdown-example-grpc"]').click();
      await page.locator('[data-testid="DropdownItemSettings-example-grpc"]').click();
      await expect(page.locator('.app')).toContainText('Request Settings greq');
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a websocket request', async ({ page }) => {
      await page.locator('button:has-text("example websocket")').click();
      await page.locator('[data-testid="Dropdown-example-websocket"]').click();
      await page.locator('[data-testid="DropdownItemSettings-example-websocket"]').click();
      await expect(page.locator('.app')).toContainText('Request Settings ws-req');
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a graphql request', async ({ page }) => {
      await page.locator('button:has-text("example graphql")').click();
      await page.locator('[data-testid="Dropdown-example-graphql"]').click();
      await page.locator('[data-testid="DropdownItemSettings-example-graphql"]').click();
      await expect(page.locator('.app')).toContainText('Request Settings req');
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a folder', async ({ page }) => {
      await page.locator('button:has-text("test folderOPEN")').click();
      await page.locator('[data-testid="Dropdown-test-folder"] button').click();
      await page.locator('[data-testid="DropdownItemSettings-test-folder"]').click();
      await expect(page.locator('.app')).toContainText('Folder Settings fld');
    });

    test('Open properties of the collection', async ({ page }) => {
      await page.locator('button:has-text("simple")').click();
      await page.locator('button:has-text("Collection Settings")').click();
      await expect(page.locator('.app')).toContainText('Collection Settings wrk');
    });

    test('Filter by request name', async ({ page }) => {
      await page.locator('[placeholder="Filter"]').click();
      await page.locator('[placeholder="Filter"]').fill('example http');
      await page.locator('button:has-text("GETexample http")').click();
    });

    test.fixme('Filter by a folder name', async () => {
      // TODO implement
    });

    test.fixme('Open Generate code and copy as curl', async () => {
      // TODO implement
    });

    test.fixme('Pin a Request', async () => {
      // TODO implement
    });

    test.fixme('Delete Request', async () => {
      // TODO implement
    });

    test.fixme('Rename a request', async () => {
      // TODO implement
    });

    test('Create a new HTTP request', async ({ page }) => {
      await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
      await page.locator('[data-testid="CreateHttpRequest"]').first().click();
      await expect(page.locator('.app')).toContainText('New Request');
    });

  // TODO: more scenarios will be added in follow-up iterations of increasing test coverage
  });
});
