import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// A request with response history can be restored to a past send from the
// Response History dropdown. Editing such a request nudges the user towards it,
// and the dropdown explains what selecting a row does.
const URL_SEL = 'div.editor__container:has(textarea#request-url-bar) .CodeMirror';

test('Editing a request with history points at Response History', async ({ page, insomnia }) => {
  test.slow();
  await insomnia.projectPage.importFixture('response-download-collection.yaml');
  await insomnia.navigationSidebar.clickRequestOrFolder('JSON Request');

  const send = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
  await send.click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');
  await send.click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

  const hint = page.getByTestId('response-history-hint');
  const historyTrigger = page.locator('.pane__header__right').getByRole('button');
  await expect.soft(hint).toBeHidden();

  // Editors flush their value on blur, which re-sends unchanged data. That is not an
  // edit: focusing a field and leaving it must not show the hint.
  await page.locator(`${URL_SEL} textarea`).focus();
  await page.keyboard.press('Tab');
  await expect.soft(hint).toBeHidden();

  // Deleting the current response restores the remaining request version, which
  // bumps the request's modified time. That is not an edit and must not consume
  // the one hint.
  await historyTrigger.click();
  await page.getByRole('menuitem', { name: 'Delete Current Response' }).click();
  // Deleting remounts the dropdown (its key is the active response), which closes the
  // menu once the action has been applied. Only then is the hint decision re-run.
  await expect.soft(page.locator('.dropdown__menu')).toHaveCount(0);
  await expect.soft(hint).toBeHidden();

  await page.locator(`${URL_SEL} textarea`).focus();
  await page.keyboard.type('?page=1');

  await expect.soft(hint).toContainText('Response History');
  await expect.soft(hint).toContainText('Click any past response to restore the Request and Response from that send.');

  await historyTrigger.click();
  await expect
    .soft(page.getByTestId('dropdown-header'))
    .toHaveText('Click any row to restore the Request and Response from that send. Unsent changes will be lost.');
});
