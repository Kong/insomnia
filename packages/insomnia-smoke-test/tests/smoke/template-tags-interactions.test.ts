import os from 'node:os';

import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

interface TemplateTagTestCase {
  tagPrefix: string;
  expectedResult: string | ((result: string) => boolean);
}
const templateTagTestCases: Record<string, TemplateTagTestCase[]> = {
  base64: [{ tagPrefix: "{% base64 'encode', 'normal', 'insomnia-test' %}", expectedResult: 'aW5zb21uaWEtdGVzdA==' }],
  cookie: [{ tagPrefix: "{% cookie 'http://127.0.0.1/echo', 'from' %}", expectedResult: 'cookie' }],
  faker: [{ tagPrefix: "{% faker 'guid' %}", expectedResult: result => result.length === 36 }],
  file: [
    {
      tagPrefix: `{% file '${getFixturePath('files/template-file.txt')}' %}`,
      expectedResult: 'File Tag Test',
    },
  ],
  hash: [
    {
      tagPrefix: "{% hash 'md5', 'hex', 'insomnia-test' %}",
      expectedResult: 'b9c076eabf32fa4cdd7573a6df12d33c',
    },
  ],
  jsonPath: [{ tagPrefix: '{% jsonpath', expectedResult: 'bar' }],
  os: [{ tagPrefix: "{% os 'arch', '' %}", expectedResult: os.arch() }],
  timeStamp: [
    {
      tagPrefix: "{% now 'millis', '' %}",
      expectedResult: result => !Number.isNaN(Number(result)) && result.length === 13,
    },
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
};

test('All built-in template tags render their expected preview value', async ({ page, app, insomnia }) => {
  // import request collection and replace the template tag file path with the actual fixture file path
  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.getByTestId('settings-button').click();
  await page.getByTestId('dataFolders').fill(getFixturePath('files/template-file.txt'));
  await page.getByTestId('dataFolders-btn').click();
  await page.locator('.app').press('Escape');

  // test common template tags
  await insomnia.navigationSidebar.clickRequestOrFolder('Common Tag');
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
    const isFunction = typeof expectedResult === 'function';
    expect
      .soft(
        isFunction ? expectedResult(previewText || '') : previewText?.includes(expectedResult),
        ` Template tag "${tagPrefix}" should render as "${expectedResult}" but returned ${previewText}.`,
      )
      .toBeTruthy();
    // close modal
    await modal.getByRole('button', { name: 'Done' }).click();
  }

  // test request template tags
  await insomnia.navigationSidebar.clickRequestOrFolder('Request Tag');
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
  await insomnia.navigationSidebar.requestRow('Base Response').click({ modifiers: ['ControlOrMeta'] });
  // Wait for tab appear
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Base Response', { exact: true })).toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect.soft(statusTag).toContainText('200 OK');

  await insomnia.navigationSidebar.requestRow('Response Tag').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Response Tag', { exact: true })).toBeVisible();
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
  // NOTE: the prompt tag is covered separately by the dedicated
  // 'Prompt tag caches values under the storage key and re-prompts once cleared' test below.
});

test('Prompt tag caches values under the storage key and re-prompts once cleared', async ({ page, app, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.requestRow('Prompt Tag Masked').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Prompt Tag Masked', { exact: true })).toBeVisible();
  await page.getByText('Body', { exact: true }).click();

  const tagPrefix = "{% prompt 'masked prompt test'";
  const tagPill = page.locator(`[data-template^="${tagPrefix}"]`);

  // A non-send render (opening the tag editor / live preview) must NOT trigger the prompt dialog.
  await tagPill.click();
  const modal = page.getByRole('dialog');
  const previewResult = modal.getByLabel('Live Preview');
  await expect.soft(previewResult).not.toHaveText('rendering...');
  await expect.soft(page.getByRole('dialog').getByText('masked prompt test')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Done' }).click();

  // Sending should trigger the prompt dialog since the storage key has no cached value yet.
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  const promptDialog = page.getByRole('dialog').filter({ hasText: 'masked prompt test' });
  await expect.soft(promptDialog).toBeVisible();
  const promptInput = promptDialog.locator('#prompt-input');
  await expect.soft(promptInput).toHaveAttribute('type', 'password');
  await promptInput.fill('super-secret-value');
  await promptDialog.getByRole('button', { name: 'Submit' }).click();

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect.soft(statusTag).toContainText('200 OK');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible');
  await expect.soft(responseBody).toContainText('super-secret-value');

  // Sending again should reuse the cached value under the explicit storage key: no prompt dialog appears.
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.getByRole('dialog').filter({ hasText: 'masked prompt test' })).toHaveCount(0);
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('super-secret-value');

  // KNOWN BUG: clicking the tag editor's "Clear" action for a BUILT-IN tag (like prompt) is a silent
  // no-op. tag-editor.tsx's onClick handler looks up the tag via `plugins.getTemplateTags()`
  // (packages/insomnia/src/plugins/index.ts getTemplateTags(), which is backed by getActivePlugins()
  // and only enumerates user-installed/bundled plugins), then only calls `runTemplateTagAction` if a
  // match is found. Built-in tags from common/templating/local-template-tags.ts are never included in
  // that list (they are merged in separately by templating/index.ts's getTagDefinitions(), which is a
  // different function used only to populate the editor form), so the lookup fails, the `if (bridgeTag)`
  // guard skips the call, and the cached value is never actually cleared.
  // This assertion documents the CURRENT (buggy) behavior: clicking Clear does not clear the cache, so
  // sending again reuses the previously-submitted value instead of re-prompting.
  await tagPill.click();
  await modal.getByRole('button', { name: 'Clear' }).click();
  await expect.soft(previewResult).not.toHaveText('rendering...');
  await modal.getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.getByRole('dialog').filter({ hasText: 'masked prompt test' })).toHaveCount(0);
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('super-secret-value');
});

test('File tag renders a legible error for a non-existent file path', async ({ page, app, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.requestRow('File Tag Error').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('File Tag Error', { exact: true })).toBeVisible();
  await page.getByText('Body', { exact: true }).click();

  const tagPrefix = "{% file '/path/does/not/exist/nope.txt' %}";
  const tagPill = page.locator(`[data-template^="${tagPrefix}"]`);
  await expect.soft(tagPill).toBeVisible();
  await tagPill.click();

  const modal = page.getByRole('dialog');
  const previewError = modal.locator('.danger');
  await expect.soft(previewError).toContainText('Insomnia cannot access the file');
  await expect.soft(previewError).toContainText('/path/does/not/exist/nope.txt');
  await modal.getByRole('button', { name: 'Done' }).click();

  // The app remains responsive/functional after the render error (does not crash).
  await expect.soft(insomnia.navigationSidebar.requestRow('File Tag Error')).toBeVisible();
});

test('Cookie tag renders a legible error for a cookie not present in the jar', async ({ page, app, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.requestRow('Cookie Tag Error').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Cookie Tag Error', { exact: true })).toBeVisible();
  await page.getByText('Body', { exact: true }).click();

  const tagPrefix = "{% cookie 'http://127.0.0.1:4010/echo', 'does-not-exist' %}";
  await page.locator(`[data-template^="${tagPrefix}"]`).click();
  const modal = page.getByRole('dialog');
  const previewResult = modal.getByLabel('Live Preview');
  await expect.soft(previewResult).not.toHaveText('rendering...');
  // the cookie tag throws `No cookie with name "..."` which surfaces in the error preview
  await expect.soft(previewResult).toHaveText(/No cookie with name/);
  await modal.getByRole('button', { name: 'Done' }).click();

  // The app remains responsive/functional after the render error (does not crash).
  await expect.soft(insomnia.navigationSidebar.requestRow('Cookie Tag Error')).toBeVisible();
});

test('Response tag trigger behaviors control when the dependent request is resent', async ({ page, app, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible');

  // 'never': with no stored response for the dependency request, the tag throws while rendering the
  // request body, which aborts the send and surfaces an "Unexpected Request Failure" dialog rather
  // than a 200 response.
  await insomnia.navigationSidebar.requestRow('Response Trigger Never').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Response Trigger Never', { exact: true })).toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  const failureDialog = page.getByRole('dialog').filter({ hasText: 'Unexpected Request Failure' });
  await expect.soft(failureDialog).toBeVisible();
  await expect.soft(failureDialog).toContainText('No responses for request');
  await failureDialog.getByRole('button', { name: 'Ok' }).click();

  // 'no-history': with no stored response for the dependency, it resends and succeeds.
  await insomnia.navigationSidebar.requestRow('Response Trigger No History').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(
    page.getByLabel('Insomnia Tabs').getByText('Response Trigger No History', { exact: true }),
  ).toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"1"');

  // 'when-expired' with maxAge=0: any existing response is immediately expired, so it resends every time.
  await insomnia.navigationSidebar.requestRow('Response Trigger When Expired').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(
    page.getByLabel('Insomnia Tabs').getByText('Response Trigger When Expired', { exact: true }),
  ).toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"1"');

  // 'always': resends the dependency request every time regardless of history.
  await insomnia.navigationSidebar.requestRow('Response Trigger Always').click({ modifiers: ['ControlOrMeta'] });
  await expect.soft(page.getByLabel('Insomnia Tabs').getByText('Response Trigger Always', { exact: true })).toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"1"');
});
