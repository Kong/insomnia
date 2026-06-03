import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Smoke tests for LiquidJS rendering isolation: env var substitution, control flow,
// and blocked file-loading tags (include/render/layout).
// Run: npm run test:smoke:dev -- template-liquid-isolation

test('LiquidJS template rendering — env vars and control flow', async ({ page, insomnia }) => {
  await insomnia.projectPage.importFixture('liquid-security-collection.yaml');

  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
  const responsePane = page.getByTestId('response-pane');
  const statusTag = responsePane.getByTestId('response-status-tag');
  const responseBody = responsePane.locator('[data-testid="CodeEditor"]:visible');

  await insomnia.navigationSidebar.clickRequestOrFolder('Env Var Rendering');
  await sendButton.click();
  await statusTag.waitFor({ state: 'visible' });
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect.soft(responseBody).toContainText('Hello world req-ENV1');

  // role=user → "standard-req-CTRL"; fingerprint guards against stale response from prior request
  await insomnia.navigationSidebar.clickRequestOrFolder('Control Flow If');
  await statusTag.waitFor({ state: 'hidden' });
  await sendButton.click();
  await statusTag.waitFor({ state: 'visible' });
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('standard-req-CTRL');

  // items=[alpha,beta,gamma] → "[alpha][beta][gamma] req-LOOP"
  await insomnia.navigationSidebar.clickRequestOrFolder('For Loop Iteration');
  await statusTag.waitFor({ state: 'hidden' });
  await sendButton.click();
  await statusTag.waitFor({ state: 'visible' });
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('[alpha][beta][gamma] req-LOOP');

  await insomnia.navigationSidebar.clickRequestOrFolder('Assign And Unless');
  await statusTag.waitFor({ state: 'hidden' });
  await sendButton.click();
  await statusTag.waitFor({ state: 'visible' });
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('Bearer abc123 req-AUTH');
});

test('LiquidJS blocked file-loading tags produce render errors', async ({ page, insomnia }) => {
  await insomnia.projectPage.importFixture('liquid-security-collection.yaml');

  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });

  // include/render/layout are disabled; each must surface an error dialog mentioning "disabled".
  for (const requestName of ['Blocked Include Tag', 'Blocked Render Tag', 'Blocked Layout Tag']) {
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);
    await sendButton.click();

    const dialog = page.getByRole('dialog');
    await expect.soft(dialog, `${requestName}: expected a render error dialog`).toBeVisible();
    await expect.soft(dialog, `${requestName}: expected "disabled" in error message`).toContainText('disabled');
    await dialog.getByRole('button', { name: 'OK' }).click();
  }
});
