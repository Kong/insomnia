import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"]');
    await page.click('text=Create');
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
    await page.click('text=Collectionsimplejust now');
  });

  test.describe('Interact with sidebar', async  () => {
    test('Open Properties of an HTTP Request', async ({ page }) => {
      await page.locator('button:has-text("example http")').click();
      await page.locator('li:nth-child(4) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
      await page.locator('button:has-text("Settings")').nth(3).click();
      await expect(page.locator('.app')).toContainText('Request Settings req');
      await page.locator('text=Request Settings req >> button').first().click();
    });

    test('Open properties of a grpc request', async ({ page }) => {
      await page.locator('button:has-text("example grpc")').click();
      await page.locator('li:nth-child(2) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
      await page.locator('button:has-text("Settings")').nth(1).click();
      await expect(page.locator('.app')).toContainText('Request Settings greq');
      await page.locator('text=Request Settings greq >> button').click();
    });

    test('Open properties of a websocket request', async ({ page }) => {
      await page.locator('button:has-text("example websocket")').click();
      await page.locator('.sidebar__actions > .dropdown > button').first().click();
      await page.locator('button:has-text("Settings")').first().click();
      await expect(page.locator('.app')).toContainText('Request Settings ws-req');
      await page.locator('text=Request Settings ws-req >> button').first().click();
    });

    test('Open properties of a graphql request', async ({ page }) => {
      await page.locator('button:has-text("example graphql")').click();
      await page.locator('li:nth-child(3) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
      await page.locator('button:has-text("Settings")').nth(2).click();
      await expect(page.locator('.app')).toContainText('Request Settings req');
      await page.locator('text=Request Settings req >> button').first().click();
    });

    // test('Open properties of a folder', async ({ page }) => {});
    // TODO

    test('Open properties of the collection', async ({ page }) => {
      await page.locator('div:nth-child(12) > .dropdown__backdrop').click();
      await page.locator('button:has-text("Settings")').click();
      await page.locator('.btn').first().click();
      await page.locator('li:nth-child(5) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
    });

    test('Filter by request name', async ({ page }) => {
      await page.locator('[placeholder="Filter"]').click();
      await page.locator('[placeholder="Filter"]').fill('example');
      // Press Enter
      await page.locator('[placeholder="Filter"]').press('Enter');
      // TODO check if filter results worked
    });

    test('Filter by a folder name', async ({ page }) => {
      await page.locator('button:has-text("My FolderOPEN")').click();
      await page.locator('div:nth-child(2) > .btn').click();
      await page.locator('button:has-text("Folders First")').click();
      // TODO
      await page.locator('.sidebar__actions > .dropdown > button').first().click();
      await page.locator('div:nth-child(19) > .dropdown__list > ul > li:nth-child(6) > button').click();
      // TODO check if filter results worked
    });

    // Generate Code
    test('Open Generate code and copy as curl', async ({ page }) => {
      await page.locator('button:has-text("Generate Code⇧ ⌘ G")').nth(1).click();
      await page.locator('button:has-text("Settings")').first().click();

      await page.locator('text=Done').click();
      await page.locator('li:nth-child(4) > .sidebar__item > .sidebar__actions > .dropdown > button').click();

      await page.locator('button:has-text("Copy as Curl")').nth(1).click();
    });

    test('Pin a Request', async ({ page }) => {
      await page.locator('button:has-text("GETNew Request")').click();
      await page.locator('li:nth-child(5) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
      await page.locator('button:has-text("Pin⇧ ⌘ P")').nth(3).click();
      // TODO assert the pin worked
    });

    test('Delete Request', async ({ page }) => {
      await page.locator('button:has-text("Delete⇧ ⌘ Delete")').nth(4).click();
      await page.locator('button:has-text("Delete")').first().click();
      await page.locator('.sidebar__actions > .dropdown > button').first().click();
      // TODO assert the delete request worked
    });

    test('Rename a request', async ({ page }) => {
      await page.locator('button:has-text("Rename")').nth(4).click();
      await page.locator('button:has-text("Settings")').first().click();
      await page.locator('text=Rename RequestName Rename >> input[type="text"]').fill('example http-2');
      await page.locator('#root button:has-text("Settings")').click();
    });

    test('Create a new HTTP request', async ({ page }) => {
      await page.locator('text=New HTTP Request').click();
      await page.locator('li:nth-child(5) > .sidebar__item > .sidebar__actions > .dropdown > button').click();
      await page.locator('div:nth-child(9) > .dropdown__backdrop').click();
    });
  });

  // TODO: more scenarios will be added in follow-up iterations of increasing test coverage
});
