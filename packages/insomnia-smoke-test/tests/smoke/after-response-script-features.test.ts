import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('after-response script features tests', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test('all', async ({ page, app }) => {
    const text = await loadFixture('after-response-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    await page.getByLabel('After-response Scripts').click();

    // set transient var
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await page.getByLabel('Request Collection').getByTestId('transient var').press('Enter');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify response
    await page.waitForSelector('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag).toContainText('200 OK');

    // verify
    await page.getByRole('tab', { name: 'Tests' }).click();

    const rows = page.getByTestId('test-result-row');
    await expect.soft(rows.first()).toContainText('PASS');

    // post: insomnia.test and insomnia.expect can work together
    await page.getByLabel('Request Collection').getByTestId('tests with expect and test').press('Enter');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await page.getByRole('tab', { name: 'Tests' }).click();

    const responsePane = page.getByTestId('response-pane');
    await expect.soft(responsePane).toContainText('PASS');
    await expect
      .soft(responsePane)
      .toContainText(
        'FAILunhappy tests | error: AssertionError: expected 199 to deeply equal 200 | ACTUAL: 199 | EXPECTED: 200',
      );
    await expect.soft(responsePane).toContainText('PASShappyTestInFunc');
    await expect
      .soft(responsePane)
      .toContainText(
        'FAILsadTestInFunc | error: AssertionError: expected 199 to deeply equal 200 | ACTUAL: 199 | EXPECTED: 200',
      );
    await expect.soft(responsePane).toContainText('PASSasyncHappyTestInFunc');
    await expect
      .soft(responsePane)
      .toContainText(
        'FAILasyncSadTestInFunc | error: AssertionError: expected 199 to deeply equal 200 | ACTUAL: 199 | EXPECTED: 200',
      );

    // environment and baseEnvironment can be persisted
    const statusTag1 = page.locator('[data-testid="response-status-tag"]:visible');
    await page.getByLabel('Request Collection').getByTestId('persist environments').press('Enter');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify response
    await page.waitForSelector('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag1).toContainText('200 OK');

    // verify persisted environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    const responseBody = page.getByRole('dialog').getByTestId('CodeEditor').locator('.CodeMirror-line');
    const rows1 = await responseBody.allInnerTexts();
    const bodyJson = JSON.parse(rows1.join(' '));

    expect.soft(bodyJson).toEqual({
      // no environment is selected so the environment value will be persisted to the base environment
      __fromAfterScript1: 'baseEnvironment',
      __fromAfterScript2: 'collection',
      __fromAfterScript: 'environment',
      base_url: 'http://localhost:4010',
    });
    await page.getByRole('button', { name: 'Close' }).click();
  });
});
