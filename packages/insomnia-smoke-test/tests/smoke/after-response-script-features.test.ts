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

    // import global environment
    const globalEnvText = await loadFixture('script-global-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), globalEnvText);
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
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // globals and baseGlobals can be persisted
    await page.getByTestId('underlay').click();
    await page.getByLabel('Request Collection').getByTestId('persist global environment').press('Enter');
    // activate global sub environment
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a global environment').click();
    await page.getByRole('option', { name: 'Script Environment' }).click();
    await page.getByRole('option', { name: 'Sub Script Env' }).click();
    await page.getByTestId('underlay').click();
    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    // check when activate global sub environment, globals refers to the selected while baseGlobals refers to the base env
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('log: globals sub').click();
    await page.getByText('log: baseGlobals base').click();
    // view sub environment has been updated
    await page.getByLabel('Manage Environments').click();
    await page.getByLabel('Manage global environment').click();
    await page.getByLabel('Environment name').getByText('Sub Script Env').first().click();
    let globalSubEditor = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
    let globalSubRows = await globalSubEditor.allInnerTexts();
    let globalSubBodyJson = JSON.parse(globalSubRows.join(' '));
    expect.soft(globalSubBodyJson).toEqual({
      // if select global sub environment, globals will point to the selected sub environment
      __env_source: 'sub',
      __fromGlobals: 'selectedGlobal',
    });
    await page.getByLabel('Environment name').getByText('Base Script Env').click();
    globalSubEditor = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
    globalSubRows = await globalSubEditor.allInnerTexts();
    globalSubBodyJson = JSON.parse(globalSubRows.join(' '));
    expect.soft(globalSubBodyJson).toEqual({
      // if select global sub environment, baseGlobals will point to the base environment of the selected one
      __env_source: 'base',
      __fromBaseGlobals: 'selectedBaseGlobal',
    });
  });
});
