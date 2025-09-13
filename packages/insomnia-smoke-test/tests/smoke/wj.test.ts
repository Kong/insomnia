import { expect } from '@playwright/test';
import { delay } from 'insomnia/src/common/misc';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('wj send requests', async ({ app, page }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');

  await page.getByRole('button', { name: 'Create request collection' }).click();

  // Check the default request in requests list
  await expect.soft(page.getByTestId('My first request').getByText('My first request')).toBeVisible();

  // Send GET request
  await page.getByTestId('request-pane').locator('header pre').nth(2).click();
  await page.getByTestId('request-pane').locator('header pre').nth(2).pressSequentially('http://127.0.0.1:4010/echo');
  await expect.soft(page.getByTestId('request-pane').getByLabel('Params').getByText('http://127.0.0.1:4010/echo')).toBeVisible();

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');

  await expect.soft(responseBody).toContainText(`"method": "GET",`);
  await expect.soft(responseBody).toContainText(`"host": "127.0.0.1:4010",`);

  // Create a new request and send a POST request
  await page.getByRole('button', { name: 'Create in collection' }).click();
  await page.getByText('HTTP Request').click();
  await expect.soft(page.getByTestId('New Request').getByText('New Request')).toBeVisible(); // Check the new request in requests list

  await page.getByTestId('New Request').hover();
  await page.getByTestId('Dropdown-New-Request').click();
  await page.getByText('Rename').click();
  await page.getByRole('textbox', { name: 'GET New Request' }).fill('My POST Request');
  await page.getByRole('textbox', { name: 'GET New Request' }).press('Enter');
  await page.getByLabel('Insomnia Tabs').getByText('My POST Request').click();

  await page.getByTestId('request-pane').locator('header pre').nth(2).click();
  await page.getByTestId('request-pane').locator('header').getByRole('textbox').fill('http://127.0.0.1:4010/echo');
  await expect.soft(page.getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/echo')).toBeVisible();

  await page.getByRole('button', { name: 'Request Method' }).click();
  await page.getByRole('button', { name: 'POST' }).click();

  await page.getByText('Body').click();
  await page.getByRole('button', { name: 'No Body Change Body Type' }).click();
  await page.getByRole('option', { name: 'Plain Text' }).click();

  await page.getByTestId('CodeEditor').getByRole('textbox').pressSequentially('test text');
  await expect.soft(page.getByTestId('CodeEditor')).toContainText('test text');
  await page.getByTestId('CodeEditor').getByRole('textbox').blur();

  await delay(500); // Wait for the request to be ready. Maybe there is a better way to do this?

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  await expect.soft(statusTag).toContainText('200 OK');

  await expect.soft(responseBody).toContainText(`"method": "POST",`);
  await expect.soft(responseBody).toContainText(`"data": "test text",`);

});
