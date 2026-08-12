import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// Toggling a mode/sub-tab that hides a CodeEditor (markdown write<->preview,
// pre/after-response scripts) unmounts it while it has no viewport size. Its undo
// history must still be persisted and restored so Cmd/Ctrl+Z keeps working after
// toggling back. See docs/undo-redo-baseline.md.

const isMac = process.platform === 'darwin';
const MD_SEL = 'div.editor__container:has(textarea#markdown-editor) .CodeMirror';
const PRE_SEL = 'div.editor__container:has(textarea[id$="pre-request-script"]) .CodeMirror';

const readState = (page: Page, sel: string) =>
  page.evaluate((s: string) => {
    const node = document.querySelector(s) as any;
    const cm = node?.CodeMirror;
    return {
      value: cm?.getValue() as string,
      undo: cm?.historySize().undo as number,
    };
  }, sel);

test('markdown editor: toggling write/preview keeps undo history', async ({ page }) => {
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();

  // Scope everything to the Docs panel: the markdown editor's DOM id is not unique
  // app-wide, so target the one CodeEditor inside this tabpanel.
  const docs = page.getByRole('tabpanel', { name: 'Docs' });
  const mdCm = docs.locator(MD_SEL);
  const readCm = () =>
    mdCm.evaluate((node: any) => ({
      value: node.CodeMirror?.getValue() as string,
      undo: node.CodeMirror?.historySize().undo as number,
    }));

  // Click into the editor to focus it reliably, then type.
  await mdCm.click();
  await page.keyboard.type('hello markdown undo');
  await expect.soft(mdCm).toContainText('hello markdown undo');
  const before = await readCm();
  expect.soft(before.undo).toBeGreaterThan(0);

  // Toggle to Preview (unmounts the editor) and back to Write (remounts it).
  const mdTabs = docs.getByRole('tablist', { name: 'Markdown editor tabs' });
  await mdTabs.getByRole('tab', { name: 'Preview' }).click();
  await expect.soft(mdCm).toBeHidden();
  await mdTabs.getByRole('tab', { name: 'Write' }).click();
  await expect.soft(mdCm).toContainText('hello markdown undo');

  // Value preserved AND the undo stack restored across the remount (was clobbered
  // before the fix).
  const after = await readCm();
  expect.soft(after.value).toContain('hello markdown undo');
  expect.soft(after.undo).toBe(before.undo);

  // Undo works on the remounted editor: it reverts the edit made before the toggle.
  await mdCm.click();
  await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
  await expect.poll(async () => (await readCm()).value).not.toContain('hello markdown undo');
});

test('request scripts: toggling pre/after-response keeps undo history', async ({ page }) => {
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  await page.getByRole('tab', { name: 'Scripts' }).click();

  await page.locator(`${PRE_SEL} textarea`).first().focus();
  // Plain text: avoids JS-mode bracket/quote auto-closing that would skew assertions.
  await page.keyboard.type('undoMarkerVariable');
  await expect.soft(page.locator(PRE_SEL).first()).toContainText('undoMarkerVariable');
  expect.soft((await readState(page, PRE_SEL)).undo).toBeGreaterThan(0);

  // Toggle to After-response (unmounts the pre-request editor) and back.
  const scriptTabs = page.getByRole('tablist', { name: 'Request scripts tabs' });
  await scriptTabs.getByRole('tab', { name: 'After-response' }).click();
  await expect.soft(page.locator(PRE_SEL)).toBeHidden();
  await scriptTabs.getByRole('tab', { name: 'Pre-request' }).click();
  await expect.soft(page.locator(PRE_SEL).first()).toContainText('undoMarkerVariable');

  const after = await readState(page, PRE_SEL);
  expect.soft(after.value).toContain('undoMarkerVariable');
  expect.soft(after.undo).toBeGreaterThan(0);

  await page.locator(`${PRE_SEL} textarea`).first().focus();
  await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
  await expect.soft(page.locator(PRE_SEL).first()).not.toContainText('undoMarkerVariable');
});
