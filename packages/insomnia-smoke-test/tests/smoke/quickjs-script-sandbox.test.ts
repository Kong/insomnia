import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Covers PR 0 (opt-in QuickJS engine) and PR 1 (Web Worker boundary) of the QuickJS
// script-sandbox rollout plan — https://gist.github.com/jackkav/3ebf8768bf84be024a3a138874919354
//
// insomnia.sendRequest() (PR 2) is deliberately NOT exercised here — it crashes under the real
// Electron/Worker/QuickJS environment (a QuickJSUseAfterFree that never reproduces in vitest's
// mocked-fetch unit tests) and has been pulled into its own WIP branch/PR until that's root-caused.
// This suite stays scoped to what's actually shipped: console, insomnia.environment/variables
// get/set, read-only insomnia.request, and the worker-boundary responsiveness guarantee.
//
// Uses "testQueryParams", a request at the workspace root (not nested in any folder) with no body
// and no folder-inherited after-response script — every other candidate in this fixture either
// references environment variables undefined until a pre-request script runs (triggering a "N
// environment variables are missing" confirmation dialog) or inherits a folder-level after-response
// script that calls an API this minimal engine doesn't bridge, turning an otherwise-successful send
// into a displayed "Error" status. Asserting via the Console tab (console.log output) instead of an
// echoed response body sidesteps template-rendering entirely.
test.describe('QuickJS script sandbox', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  // CodeMirror debounces onChange (DEBOUNCE_MILLIS, ~100ms) before it commits to the request
  // model — clicking Send right after `.fill()` races that debounce and can send the *previous*
  // script/body. Select-all + delete first (fill() alone doesn't reliably clear existing CodeMirror
  // content) and wait past the debounce before treating the editor as settled. Mirrors the pattern
  // in pre-request-script-features.test.ts.
  const replaceCodeEditorContent = async (page: Page, value: string) => {
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await editor.fill(value);
    // Wait for CodeMirror debounce (DEBOUNCE_MILLIS ~100ms)
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
  };

  // Enable the QuickJS sandbox via Preferences → Scripting, then close the modal — mirrors
  // sandbox-template-tags.test.ts's `enableSandbox` helper for the plugin template-tag sandbox.
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

  test('runs console/environment/request-read scripts through the QuickJS engine', async ({ page, insomnia }) => {
    await enableQuickJsSandbox(page);

    await insomnia.navigationSidebar.clickRequestOrFolder('testQueryParams');

    // The canary (`typeof require`) proves this ran inside QuickJS, not the hidden window (which
    // has `require` — see this fixture's "require the url module" case); a mis-wired toggle would
    // otherwise make every assertion below pass vacuously against the legacy engine. Also exercises
    // insomnia.environment.set/get and read-only insomnia.request — everything PR 0/PR 1 ship.
    await page.getByRole('tab', { name: 'Scripts' }).click();
    await replaceCodeEditorContent(
      page,
      `
      const engine = typeof require === 'function' ? 'hidden-window' : 'quickjs';
      insomnia.environment.set('canaryEngine', engine);
      console.log('canary: ' + engine + ' | request: ' + insomnia.request.name);
    `,
    );

    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('canary: quickjs | request: testQueryParams')).toBeVisible();
  });

  test('a runaway script blocks only the QuickJS worker, not the app UI', async ({ page, insomnia }) => {
    await enableQuickJsSandbox(page);

    await insomnia.navigationSidebar.clickRequestOrFolder('testQueryParams');

    await page.getByRole('tab', { name: 'Scripts' }).click();
    await replaceCodeEditorContent(page, 'while (true) { /* deliberately never returns */ }');

    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // The script is now busy-looping inside its dedicated Worker (PR 1) and will never finish. If
    // QuickJS ran on the renderer's own main thread instead, this tab switch would hang along with
    // it; asserting it stays interactive right away is the whole point of the worker boundary.
    await page.getByRole('tab', { name: 'Headers' }).click();
    await expect.soft(page.getByRole('tab', { name: 'Headers' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Params' }).click();
    await expect.soft(page.getByRole('tab', { name: 'Params' })).toHaveAttribute('aria-selected', 'true');
  });
});
