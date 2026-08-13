import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// PR 2 of the QuickJS script-sandbox rollout plan —
// https://gist.github.com/jackkav/3ebf8768bf84be024a3a138874919354
//
// KNOWN BUG (unresolved): insomnia.sendRequest() crashes under the real Electron/Worker/QuickJS
// environment with `Aborted(Assertion failed: list_empty(&rt->gc_obj_list), at:
// .../quickjs.c,2036,JS_FreeRuntime)` on the first real network round trip, even after three
// targeted fixes (see quickjs-script-engine.ts's module doc comment and installSendRequestBridge).
// This never reproduces in vitest (mocked fetch, or a plain Node http server) — only real Electron
// fetch() timing inside the dedicated Worker reproduces it. `test.fail()` marks this as an expected
// failure: CI stays green while the bug is open, and flips red (telling us to remove the
// annotation) the moment someone actually fixes it.
test.describe('QuickJS sendRequest bridge (known bug)', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  // Same pattern as quickjs-script-sandbox.test.ts's helper.
  const replaceCodeEditorContent = async (page: Page, value: string) => {
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await editor.fill(value);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
  };

  const enableQuickJsSandbox = async (page: Page) => {
    await page.getByTestId('settings-button').click();
    const sandboxToggle = page.getByTestId('toggle-quickjs-script-sandbox');
    await page.getByRole('tab', { name: 'Scripting' }).click();
    await sandboxToggle.getByRole('switch').waitFor();
    await sandboxToggle.click();
    await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
    await page.locator('.app').press('Escape');
    await expect.soft(page.getByTestId('toggle-quickjs-script-sandbox')).toBeHidden();
  };

  test('runs a real sendRequest() round trip through the QuickJS engine', async ({ page, insomnia }) => {
    test.fail(true, 'insomnia.sendRequest() crashes under real Electron/Worker timing — see file header comment');

    await enableQuickJsSandbox(page);

    // "testQueryParams" has no body and no folder-inherited after-response script — see
    // quickjs-script-sandbox.test.ts's header comment for why every other candidate in this
    // fixture is unsuitable. console.log sidesteps template-rendering entirely.
    await insomnia.navigationSidebar.clickRequestOrFolder('testQueryParams');

    await page.getByRole('tab', { name: 'Scripts' }).click();
    await replaceCodeEditorContent(
      page,
      `
      const response = await insomnia.sendRequest('http://127.0.0.1:4010/echo');
      console.log('sendRequest status: ' + response.code + ' method: ' + JSON.parse(response.body).method);
    `,
    );

    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('sendRequest status: 200 method: GET')).toBeVisible();
  });
});
