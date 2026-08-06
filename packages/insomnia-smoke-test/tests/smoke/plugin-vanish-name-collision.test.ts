import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// Two plugin folders declaring the same package.json "name" must both show up in Settings, each as a
// disabled row with a "Failed to load" collision marker, instead of one being silently dropped. The
// collision is resolved order-independently (#10326): because pluginConfig — including the `elevated`
// full-host-access grant — is keyed by name, letting filesystem read order pick a "winner" could hand
// a colliding (possibly hostile) folder another folder's trust. So neither is loaded active; both are
// surfaced disabled and the user resolves the ambiguity by removing one.

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

test('Kong/insomnia#10295: two plugin folders sharing one package.json name both show up as disabled rows with a collision marker (neither loaded active)', async ({
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

  // Order-independent (#10326): neither folder is loaded active — so a colliding folder can't inherit
  // another's name-keyed trust by winning on load order. Both rows are disabled (no enable checkbox)
  // and both carry the "Failed to load" collision marker.
  await expect.soft(collidedRows.nth(0).getByRole('checkbox')).toHaveCount(0);
  await expect.soft(collidedRows.nth(1).getByRole('checkbox')).toHaveCount(0);
  await expect.soft(collidedRows.nth(0)).toContainText('Failed to load plugin');
  await expect.soft(collidedRows.nth(1)).toContainText('Failed to load plugin');

  // The collision reason is visible in the (first) row's details.
  await collidedRows.nth(0).getByTestId(`plugin-details-toggle-${SHARED_PACKAGE_NAME}`).click();
  await expect
    .soft(collidedRows.nth(0).getByTestId(`plugin-details-${SHARED_PACKAGE_NAME}`))
    .toContainText('Multiple plugin folders declare');

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
