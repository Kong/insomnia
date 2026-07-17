import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('environment cascade / override', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('environment-cascade-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });

  // Sends the current request and returns the requested field from the echoed request body,
  // so tests can assert on any variable the request renders (cascadeVar, subOnlyVar, ...).
  const sendAndGetVar = async (page: Page, field: string) => {
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const rows = await page
      .getByTestId('response-pane')
      .getByTestId('CodeEditor')
      .locator('.CodeMirror-line')
      .allInnerTexts();
    const bodyJson = JSON.parse(rows.join(' '));
    const requestBody = JSON.parse(bodyJson.data);
    return requestBody[field];
  };

  // Activating an environment reaches the picker UI slightly before it propagates to the request's
  // render context, so a single send can echo the previously-active value. Poll: re-send and re-read
  // until the freshly-active environment's value is rendered (or time out).
  const expectVar = async (page: Page, field: string, expected: string) => {
    await expect.poll(() => sendAndGetVar(page, field), { timeout: 30_000 }).toBe(expected);
  };

  const selectEnvironment = async (page: Page, insomnia: any, environmentName: string, requestName: string) => {
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    // wait for the Manage Environments dialog to close before interacting with the picker
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    await page.getByRole('option', { name: environmentName, exact: true }).press('Enter');
    await page.getByRole('option', { name: environmentName, exact: true }).press('Escape');

    // re-select the request so the request pane renders against the freshly-active environment
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);
  };

  test('folder environment (most specific) wins over sub/base environments', async ({ page, insomnia }) => {
    const requestName = 'cascade request';
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);

    // explicitly select the Base Environment (test order/state should not leak an active sub-environment)
    await selectEnvironment(page, insomnia, 'Base Environment', requestName);

    // no sub-environment active: folder env overrides the base environment value;
    // subOnlyVar (not defined in the folder) falls through to the base environment.
    await expectVar(page, 'cascadeVar', 'fromFolder');
    await expectVar(page, 'subOnlyVar', 'subOnly_base');

    // activate SubEnvA: folder env still overrides cascadeVar (folder is more specific), but
    // subOnlyVar now resolves to SubEnvA — proving the sub-environment switch propagated even
    // though cascadeVar stays masked by the folder value.
    await selectEnvironment(page, insomnia, 'SubEnvA', requestName);

    await expectVar(page, 'cascadeVar', 'fromFolder');
    await expectVar(page, 'subOnlyVar', 'subOnly_A');
  });

  test('sub environment wins over base environment; switching sub environment changes the resolved value', async ({
    page,
    insomnia,
  }) => {
    const requestName = 'cascade request no folder';
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);

    // explicitly select the Base Environment (test order/state should not leak an active sub-environment)
    await selectEnvironment(page, insomnia, 'Base Environment', requestName);

    // no sub-environment active: falls back to base environment value
    await expectVar(page, 'cascadeVar', 'fromBase');

    // activate SubEnvA: sub environment overrides the base environment value
    await selectEnvironment(page, insomnia, 'SubEnvA', requestName);

    await expectVar(page, 'cascadeVar', 'fromSubA');

    // switch active sub-environment to SubEnvB: resolved value changes accordingly
    await selectEnvironment(page, insomnia, 'SubEnvB', requestName);

    await expectVar(page, 'cascadeVar', 'fromSubB');
  });
});
