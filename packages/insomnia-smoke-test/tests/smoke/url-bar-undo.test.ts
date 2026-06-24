import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Characterisation test for the request URL bar's undo behaviour.
// Regression guard for: editing the URL must not remount/blur the editor, and
// Cmd/Ctrl+Z must undo in place while keeping focus.
// See docs/undo-redo-baseline.md.

const URL_SEL = 'div.editor__container:has(textarea#request-url-bar) .CodeMirror';
const CONTAINER_SEL = 'div.editor__container:has(textarea#request-url-bar)';
const isMac = process.platform === 'darwin';

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
