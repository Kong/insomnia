import os from 'node:os';

import { expect } from '@playwright/test';

import { loadFixture, getFixturePath } from '../../playwright/paths';
import { test } from '../../playwright/test';

interface TemplateTagTestCase {
  tagPrefix: string;
  expectedResult: string | ((result: string) => boolean);
}
const templateTagTestCases: Record<string, TemplateTagTestCase[]> = {
  base64: [{ tagPrefix: "{% base64 'encode', 'normal', 'insomnia-test' %}", expectedResult: 'aW5zb21uaWEtdGVzdA==' }],
  cookie: [{ tagPrefix: "{% cookie 'http://127.0.0.1/echo', 'from' %}", expectedResult: 'cookie' }],
  faker: [{ tagPrefix: "{% faker 'guid' %}", expectedResult: result => result.length === 36 }],
  hash: [{ tagPrefix: "{% hash 'md5', 'hex', 'insomnia-test' %}", expectedResult: 'b9c076eabf32fa4cdd7573a6df12d33c' }],
  jsonPath: [{ tagPrefix: '{% jsonpath', expectedResult: 'bar' }],
  os: [{ tagPrefix: "{% os 'arch', '' %}", expectedResult: os.arch() }],
  timeStamp: [
    { tagPrefix: "{% now 'millis', '' %}", expectedResult: result => !isNaN(Number(result)) && result.length === 13 },
  ],
  uuid: [{ tagPrefix: "{% uuid 'v4' %}", expectedResult: result => result.length === 36 }],
  request: [
    { tagPrefix: "{% request 'name'", expectedResult: 'Request Tag' },
    { tagPrefix: "{% request 'folder', '', '' %}", expectedResult: 'FolderWithRequest' },
    { tagPrefix: "{% request 'url'", expectedResult: 'http://127.0.0.1:4010/echo?foo=bar' },
    { tagPrefix: "{% request 'parameter'", expectedResult: 'bar' },
    { tagPrefix: "{% request 'cookie'", expectedResult: 'cookie' },
  ],
  response: [
    {
      tagPrefix: "{% response 'body'",
      expectedResult: 'GET',
    },
    {
      tagPrefix: "{% response 'header'",
      expectedResult: 'application/json; charset=utf-8',
    },
    {
      tagPrefix: "{% response 'url'",
      expectedResult: 'http://127.0.0.1:4010/echo',
    },
  ],
  prompt: [
    {
      tagPrefix: "{% prompt 'prompt test', '', 'test', 'insomnia-test', false, true %}",
      expectedResult: 'insomnia-test',
    },
  ],
};

test('Critical Path For Template Tags Interactions', async ({ page, app }) => {
  // import request collection
  const text = await loadFixture('template-tag-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Template Tag Collection').click();

  // test common template tags
  await page.getByLabel('Request Collection').getByTestId('Common Tag').press('Enter');
  await page.getByText('Body', { exact: true }).click();
  let commonTagTestCases: TemplateTagTestCase[] = [];
  Object.keys(templateTagTestCases)
    .filter(key => key !== 'request' && key !== 'response' && key !== 'prompt')
    .forEach(tagName => (commonTagTestCases = commonTagTestCases.concat(templateTagTestCases[tagName])));
  const testCases = commonTagTestCases;
  for (const { tagPrefix, expectedResult } of testCases) {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    const previewResult = modal.getByLabel('Live Preview');
    // wait for render complete
    await expect.soft(previewResult).not.toHaveText('rendering...');
    const previewText = await previewResult.textContent();
    expect
      .soft(
        typeof expectedResult === 'function'
          ? expectedResult(previewText || '')
          : previewText?.includes(expectedResult),
      )
      .toBeTruthy();
    // close modal
    await modal.getByRole('button', { name: 'Done' }).click();
  }

  // test request template tags
  await page.getByLabel('Request Collection').getByTestId('Request Tag').press('Enter');
  await page.getByText('Body', { exact: true }).click();
  for (const { tagPrefix, expectedResult } of templateTagTestCases.request) {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    const previewResult = modal.getByLabel('Live Preview');
    // wait for render complete
    await expect.soft(previewResult).not.toHaveText('rendering...');
    await expect.soft(previewResult).toHaveText(typeof expectedResult === 'string' ? expectedResult : '');
    // close modal
    await modal.getByRole('button', { name: 'Done' }).click();
  }

  // test response template tags
  // send request first to populate response
  await page.getByLabel('Request Collection').getByTestId('Base Response').press('Enter');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByLabel('Request Collection').getByTestId('Response Tag').press('Enter');
  await page.getByText('Body', { exact: true }).click();
  for (const { tagPrefix, expectedResult } of templateTagTestCases.response) {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    const previewResult = modal.getByLabel('Live Preview');
    // wait for render complete
    await expect.soft(previewResult).not.toHaveText('rendering...');
    await expect.soft(previewResult).toHaveText(typeof expectedResult === 'string' ? expectedResult : '');
    // close modal
    await modal.getByRole('button', { name: 'Done' }).click();
  }

  // test prompt template tags
  await page.getByLabel('Request Collection').getByTestId('Prompt Tag').press('Enter');
  await page.getByText('Body', { exact: true }).click();
  const { tagPrefix } = templateTagTestCases.prompt[0];
  await page.locator(`[data-template^="${tagPrefix}"]`).isVisible();
  await page.getByRole('button', { name: 'Send' }).click();
  // prompt is not allowed to use by default
  await expect.soft(page.getByText('Unexpected Request Failure')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  // elevate access for plugins
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Plugins' }).click();
  await page.locator('text=Allow elevated access for plugins').click();
  await page.locator('.app').press('Escape');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('dialog').locator('#prompt-input').fill('prompt-value');
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await page.click('text=Console');
  const responsePane = page.getByTestId('response-pane');
  await expect.soft(responsePane).toContainText('prompt-value');
});
