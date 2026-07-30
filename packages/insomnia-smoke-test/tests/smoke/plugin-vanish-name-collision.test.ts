import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// Two plugin folders declaring the same package.json "name" must both show up in Settings — one
// active, the other disabled with a "Failed to load" collision marker — instead of one of them
// being silently dropped.

const WINNER_DIR_NAME = 'insomnia-plugin-vanish-collision-b';
const LOSER_DIR_NAME = 'insomnia-plugin-vanish-collision-a';
// Both folders declare the exact same package.json "name" — this is the collision.
const SHARED_PACKAGE_NAME = 'insomnia-plugin-vanish-collision';

const writeCollidingPlugin = (dataPath: string, folderName: string, tagName: string) => {
  const pluginDir = path.join(dataPath, 'plugins', folderName);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: SHARED_PACKAGE_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: '${tagName}',
          displayName: '${tagName}',
          args: [],
          run() {
            return '${tagName}';
          },
        },
      ];
    `,
  );
};

const clearPluginToast = async (page: Page) => {
  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => localStorage.setItem('plugin-system-changes-toast-shown', 'true'));
  const dismissButtons = page.getByRole('button', { name: 'Dismiss' });
  await dismissButtons
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await dismissButtons.count()) > 0) {
    await dismissButtons.first().click({ force: true, timeout: 500 }).catch(() => {});
  }
};

test('Kong/insomnia#10295: two plugin folders sharing one package.json name both show up, one active and one disabled with a collision marker', async ({
  page,
  insomnia,
  dataPath,
}) => {
  await clearPluginToast(page);
  writeCollidingPlugin(dataPath, LOSER_DIR_NAME, 'vanishcollisiona');
  writeCollidingPlugin(dataPath, WINNER_DIR_NAME, 'vanishcollisionb');

  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Plugins');
  await page.getByRole('button', { name: 'Reload', exact: true }).click();

  // Both folders on disk show up as rows, even though they share a package.json name.
  const collidedRows = page.getByTestId(SHARED_PACKAGE_NAME);
  await expect.soft(collidedRows.first()).toBeVisible({ timeout: 10_000 });
  await expect.soft(collidedRows).toHaveCount(2);

  // Exactly one row has a checkbox (the winner); the other has no checkbox at all (which folder
  // wins is traversal-order dependent, so check both without asserting which).
  const firstHasCheckbox = await collidedRows.nth(0).getByRole('checkbox').count();
  const secondHasCheckbox = await collidedRows.nth(1).getByRole('checkbox').count();
  expect.soft(firstHasCheckbox > 0).not.toBe(secondHasCheckbox > 0);

  const disabledRow = firstHasCheckbox > 0 ? collidedRows.nth(1) : collidedRows.nth(0);
  await expect.soft(disabledRow).toContainText('Failed to load plugin');
  await disabledRow.getByTestId(`plugin-details-toggle-${SHARED_PACKAGE_NAME}`).click();
  const disabledRowDetail = disabledRow.getByTestId(`plugin-details-${SHARED_PACKAGE_NAME}`);
  await expect.soft(disabledRowDetail).toContainText(SHARED_PACKAGE_NAME);

  // Reload repeatedly — deterministic, so this never changes.
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await collidedRows.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await collidedRows.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  await expect.soft(collidedRows).toHaveCount(2);

  // "New Plugin" should still report "already exists" for either original folder name.
  for (const folderName of [LOSER_DIR_NAME, WINNER_DIR_NAME]) {
    await page.getByRole('button', { name: 'New Plugin' }).click();
    const nameWithoutPrefix = folderName.replace(/^insomnia-plugin-/, '');
    await page.getByTestId('plugin-name-input').fill(nameWithoutPrefix);
    await page.getByTestId('generate-plugin-button').click();

    const nameError = page.getByTestId('plugin-name-error');
    await expect.soft(nameError).toHaveText(/already exists/i, { timeout: 5000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('heading', { name: 'New Plugin' }).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
});
