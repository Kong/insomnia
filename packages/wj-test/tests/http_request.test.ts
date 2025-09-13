import { expect } from '@playwright/test';
import { delay } from 'insomnia/src/common/misc';

import { TestRunner } from '../common/test-runner';

// Run test with TestRunner
TestRunner.run('Send Requests', async ({ page, record }) => {
  const http_url = record.url;
  const http_method = record.method;
  const http_headers = record.headers;
  const http_body = record.body;
  const http_expected_status = record.expected_status;

  const delayMs = 100;
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');

  // Create a new request
  await page.getByRole('button', { name: 'New HTTP Request' }).click();
  await expect.soft(page.getByTestId('New Request').getByText('New Request')).toBeVisible();

  // Set the URL
  await page.getByTestId('request-pane').locator('header pre').nth(2).click();
  await page.getByTestId('request-pane').locator('header pre').nth(2).pressSequentially(http_url);
  await expect.soft(page.getByTestId('request-pane').getByLabel('Params').getByText(http_url)).toBeVisible();

  // Set Headers
  if (http_headers) {
    await page.getByText('Headers').click();
    const optionLine = page.getByLabel('Key-value pairs', { exact: true }).getByRole('option');
    await optionLine.getByRole('button').last().dblclick(); // reset the default header.
    await delay(delayMs);
    let keyInput, valueInput;

    let isFirst = true;
    for (const header of http_headers.split('\n')) {
      const [key, value] = header.split(':').map(s => s.trim());
      if (key && value) {
        if (isFirst) {
          // use the existing header line if it's the first one
          keyInput = optionLine.getByRole('textbox').first();
          valueInput = optionLine.getByRole('textbox').last();
          isFirst = false;
        } else {
          // add a new header if not the first one
          const addButton = page.getByTestId('request-pane').getByRole('button', { name: 'Add' });
          await expect.soft(addButton).toBeVisible();
          await addButton.focus();
          await addButton.click();

          keyInput = optionLine.nth(1).getByRole('textbox').first();
          valueInput = optionLine.nth(1).getByRole('textbox').last();
        }

        await expect.soft(keyInput).toBeVisible();
        await keyInput.focus();
        await keyInput.fill(key);
        await keyInput.blur();
        await expect.soft(keyInput).toHaveValue(key);
        await delay(delayMs);

        await valueInput.focus();
        await valueInput.fill(value);
        await valueInput.blur();
        await delay(delayMs);
      }
    }
  }

  // Set method
  await page.getByRole('button', { name: 'Request Method' }).click();
  await page.getByRole('button', { name: http_method }).click();

  // Set Body if method is POST or PUT
  if (http_method === 'POST' || http_method === 'PUT') {
    await page.getByText('Body').click();
    await page.getByRole('button', { name: 'No Body Change Body Type' }).click();
    await page.getByRole('option', { name: 'JSON' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').fill(http_body);
    await page.getByTestId('CodeEditor').getByRole('textbox').blur();
    await delay(delayMs);
  }

  // Send request
  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
  await expect.soft(sendButton).toBeVisible();
  await expect.soft(sendButton).toBeEnabled();
  await sendButton.focus();
  await sendButton.click();

  // Check response status
  await expect.soft(statusTag).toContainText(http_expected_status);

  // Check response body - to be done

});


