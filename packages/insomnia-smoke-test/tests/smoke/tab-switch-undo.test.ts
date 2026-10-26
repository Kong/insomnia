import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Regression guard for undo history surviving a tab change. Switching the active
// request unmounts the previous request's pane (its editors) and mounts the next;
// the undo history must survive that remount via the shared editor-state cache, so
// Cmd/Ctrl+Z still undoes after returning to the request. See docs/undo-redo-baseline.md.

const URL_SEL = 'div.editor__container:has(textarea#request-url-bar) .CodeMirror';
const isMac = process.platform === 'darwin';

const readUrlState = (page: Page) =>
  page.evaluate((sel: string) => {
    const node = document.querySelector(sel) as any;
    const cm = node?.CodeMirror;
    return {
      value: cm?.getValue() as string,
      undo: cm?.historySize().undo as number,
    };
  }, URL_SEL);

test('undo history survives switching request tabs', async ({ page, app, insomnia }) => {
  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, t) => clipboard.writeText(t), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  // Open the first request and edit its URL, building undo history.
  await insomnia.navigationSidebar.clickRequestOrFolder('example http');
  const urlInput = page.locator(`${URL_SEL} textarea`);
  await urlInput.focus();
  await page.keyboard.type('/undo-marker');
  // Web-first assertion settles the debounced persist + loader revalidation.
  await expect.soft(page.locator(URL_SEL)).toContainText('/undo-marker');
  expect.soft((await readUrlState(page)).undo).toBeGreaterThan(0);

  // Change tabs: to another request and back. This unmounts the first request's
  // URL editor and remounts it — the round-trip that used to drop undo history.
  await insomnia.navigationSidebar.clickRequestOrFolder('proxyEnabled');
  await insomnia.navigationSidebar.clickRequestOrFolder('example http');
  await expect.soft(page.locator(URL_SEL)).toContainText('/undo-marker');

  const afterSwitch = await readUrlState(page);
  // Value preserved AND undo history restored across the remount.
  expect.soft(afterSwitch.value).toContain('/undo-marker');
  expect.soft(afterSwitch.undo).toBeGreaterThan(0);

  // Undo works on the remounted editor: it reverts the edit made before the switch.
  await page.locator(`${URL_SEL} textarea`).focus();
  await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
  await expect.soft(page.locator(URL_SEL)).not.toContainText('/undo-marker');
});
