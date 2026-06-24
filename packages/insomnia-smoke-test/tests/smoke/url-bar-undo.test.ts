import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Characterisation tests for the request URL bar editor.
// See docs/undo-redo-baseline.md.

const URL_SEL = 'div.editor__container:has(textarea#request-url-bar) .CodeMirror';
const CONTAINER_SEL = 'div.editor__container:has(textarea#request-url-bar)';
const TAG_SEL = 'div.editor__container:has(textarea#request-url-bar) .nunjucks-tag';
const isMac = process.platform === 'darwin';

// Regression guard: editing the URL must not remount/blur the editor, and
// Cmd/Ctrl+Z must undo in place while keeping focus.
test('URL bar: editing keeps focus and Cmd+Z undoes in place', async ({ page }) => {
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

  const urlInput = page.locator(`${URL_SEL} textarea`);
  await urlInput.focus();

  // Observe CodeMirror node replacement (remount) and blur events from here on.
  await page.evaluate((containerSel: string) => {
    const w = window as any;
    w.__remountCount = 0;
    w.__blurCount = 0;
    const container = document.querySelector(containerSel)!;
    new MutationObserver(muts => {
      for (const m of muts) {
        m.removedNodes.forEach(n => {
          if ((n as HTMLElement).classList?.contains('CodeMirror')) {
            w.__remountCount++;
          }
        });
      }
    }).observe(container, { childList: true, subtree: true });
    const node = document.querySelector(containerSel + ' .CodeMirror') as any;
    node?.CodeMirror?.on('blur', () => {
      w.__blurCount++;
    });
  }, CONTAINER_SEL);

  const readState = () =>
    page.evaluate(
      ([s, c]: [string, string]) => {
        const node = document.querySelector(s) as any;
        const cm = node?.CodeMirror;
        const container = document.querySelector(c) as HTMLElement | null;
        const w = window as any;
        return {
          value: cm?.getValue() as string,
          dataFocused: container?.dataset?.focused,
          undo: cm?.historySize().undo as number,
          remounts: w.__remountCount as number,
          blurs: w.__blurCount as number,
        };
      },
      [URL_SEL, CONTAINER_SEL],
    );

  await page.keyboard.type('https://example.com/foo');
  // Web-first assertion settles the debounced persist + loader revalidation.
  await expect.soft(page.locator(URL_SEL)).toContainText('example.com');

  const afterEdit = await readState();
  // Editing must not tear down or blur the editor, and undo history must exist.
  expect.soft(afterEdit.remounts).toBe(0);
  expect.soft(afterEdit.blurs).toBe(0);
  expect.soft(afterEdit.dataFocused).toBe('on');
  expect.soft(afterEdit.undo).toBeGreaterThan(0);

  await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
  // Undo reverts the typed value (settles via web-first assertion).
  await expect.soft(page.locator(URL_SEL)).not.toContainText('example.com');

  const afterUndo = await readState();
  // Undo happened in place: no remount, focus retained.
  expect.soft(afterUndo.remounts).toBe(0);
  expect.soft(afterUndo.dataFocused).toBe('on');
});

// The "Import from URL" action replaces the URL via OneLineEditor's setValue
// handle. That replacement must stay undoable (history preserved), not wipe it.
test('URL bar: importing query params stays undoable', async ({ page }) => {
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

  const urlInput = page.locator(`${URL_SEL} textarea`);
  await urlInput.focus();
  await page.keyboard.type('https://example.com/path?foo=bar');
  await expect.soft(page.locator(URL_SEL)).toContainText('foo=bar');

  // Import query params -> strips the query from the URL via the setValue handle.
  await page.getByRole('tab', { name: 'Params' }).click();
  const importButton = page.getByRole('button', { name: 'Import from URL' });
  await expect.soft(importButton).toBeEnabled();
  await importButton.click();
  await expect.soft(page.locator(URL_SEL)).not.toContainText('foo=bar');

  // Undo must revert the import (non-destructive setValue preserves history).
  await urlInput.focus();
  await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
  await expect.soft(page.locator(URL_SEL)).toContainText('foo=bar');
});

// The editor is keyed on the environment, so switching environments must refresh
// the rendered nunjucks variable preview shown in the URL bar.
test('URL bar: switching environment refreshes the rendered preview', async ({ page, app, insomnia }) => {
  const text = await loadFixture('environments.yaml');
  await app.evaluate(async ({ clipboard }, t) => clipboard.writeText(t), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  // Open the imported request, then put an environment variable in the URL so it
  // renders an inline nunjucks preview. Replace the value via the editor API, then
  // type so onChange persists it to the model (it must survive the env remount).
  await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
  const urlInput = page.locator(`${URL_SEL} textarea`);
  await page.evaluate((sel: string) => {
    const node = document.querySelector(sel) as any;
    node?.CodeMirror?.setValue('');
  }, URL_SEL);
  await urlInput.focus();
  await page.keyboard.type('{{ _.exampleString }}');
  await page.keyboard.press('Escape');
  // confirm the variable tag rendered (innerHTML is the variable name)
  await expect.soft(page.locator(URL_SEL)).toContainText('exampleString');

  const tag = page.locator(TAG_SEL).first();

  // ExampleA -> subenvA0
  await page.getByRole('button', { name: 'Manage Environments' }).click();
  await page.getByRole('option', { name: 'ExampleA' }).press('Enter');
  await page.getByRole('option', { name: 'ExampleA' }).press('Escape');
  await expect.soft(tag).toHaveAttribute('title', /subenvA0/);

  // ExampleB -> subenvB0 (preview must refresh on switch)
  await page.getByRole('button', { name: 'Manage Environments' }).click();
  await page.getByRole('option', { name: 'ExampleB' }).press('Enter');
  await page.getByRole('option', { name: 'ExampleB' }).press('Escape');
  await expect.soft(tag).toHaveAttribute('title', /subenvB0/);
});
