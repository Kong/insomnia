import { expect } from '@playwright/test';
import { delay } from 'insomnia/src/common/misc';

import { TestRunner } from '../common/test-runner';

TestRunner.runTest(__filename, 'Create and send GET request', async ({ page }) => {
  const delayMs = 100;
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');

  // Create a new request
  await page.getByRole('button', { name: 'New HTTP Request' }).click();
  await expect.soft(page.getByTestId('New Request').getByText('New Request')).toBeVisible();

  // Set the URL
  await page.getByTestId('request-pane').locator('header pre').nth(2).click();
  await page.getByTestId('request-pane').locator('header pre').nth(2).pressSequentially('https://httpbin.org/get');
  await expect.soft(page.getByTestId('request-pane').getByLabel('Params').getByText('https://httpbin.org/get')).toBeVisible();

  // Set Headers
  await page.getByText('Headers').click();
  const optionLine = page.getByLabel('Key-value pairs', { exact: true }).getByRole('option');

  // Set Headers - change existing User-Agent header
  await expect(optionLine).toContainText('User-Agent');
  await optionLine.getByRole('textbox').last().focus();
  await optionLine.getByRole('textbox').last().press('End');
  await optionLine.getByRole('textbox').last().press('Shift+Home');
  await optionLine.getByRole('textbox').last().fill('Mozilla/5.0');
  await delay(delayMs);

  // Set Headers - add new Accept header
  const addButton = page.getByTestId('request-pane').getByRole('button', { name: 'Add' });
  await expect.soft(addButton).toBeVisible();
  await addButton.focus();
  await addButton.click();

  const keyInput = optionLine.nth(1).getByRole('textbox').first();
  const valueInput = optionLine.nth(1).getByRole('textbox').last();
  await expect.soft(keyInput).toBeVisible();
  await keyInput.focus();
  await keyInput.fill('Accept');
  await keyInput.blur();
  await expect.soft(keyInput).toHaveValue('Accept');
  await delay(delayMs);

  await valueInput.focus();
  await valueInput.fill('application/json');
  await valueInput.blur();
  await delay(delayMs);

  // Send GET request
  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
  await expect.soft(sendButton).toBeVisible();
  await expect.soft(sendButton).toBeEnabled();
  await sendButton.focus();
  await sendButton.click();

  // Check response
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText(`"Accept": "application/json",`);
  await expect.soft(responseBody).toContainText(`"url": "https://httpbin.org/get"`);
});

