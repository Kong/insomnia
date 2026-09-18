import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// An Event Stream (SSE) request is only *sent* over a streaming connection when `Accept:
// text/event-stream` is set at send time, but the response pane must follow what actually came back:
// a plain HTTP response stores its raw body where a stream stores its NDJSON event log, so flipping
// the header after sending must not turn that body into "events" (which used to take the whole
// response pane down with `Render Failure: Could not determine key for item`).
test('Event Stream: an HTTP response is not re-read as an event log after flipping the Accept header', async ({
  page,
  insomnia,
}) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const responsePane = page.getByTestId('response-pane').first();
  const responseBody = responsePane.locator('[data-testid="CodeEditor"]:visible');
  const requestPane = page.getByTestId('request-pane');

  // Compact single-line JSON: a pretty-printed body would fail to parse line by line, hiding the bug.
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
  await page.getByRole('menuitemradio', { name: 'From Curl' }).click();
  await page.getByRole('dialog').locator('.CodeMirror textarea').fill('curl --url http://127.0.0.1:4010/pets/1');
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await expect.soft(requestPane.getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/pets/1')).toBeVisible();

  await requestPane.getByRole('button', { name: 'Send' }).click();
  await expect.soft(responsePane.getByTestId('response-status-tag')).toContainText('200', { timeout: 10_000 });
  await expect.soft(responseBody).toContainText('"id"');

  // Flip the request to an Event Stream by adding its Accept header.
  await requestPane.getByRole('tab', { name: 'Headers' }).click();
  const listbox = requestPane.getByRole('listbox', { name: 'Key-value pairs', exact: true });
  await listbox.getByRole('option').last().getByTestId('OneLineEditor').first().locator('.CodeMirror').click();
  await page.keyboard.type('Accept');
  // The tab badge counts persisted headers plus the read-only rows (3), so 4 means the commit landed.
  await expect.soft(requestPane.getByRole('tab', { name: 'Headers 4' })).toBeVisible();
  const acceptRow = listbox.getByRole('option').filter({ hasText: 'Accept' }).first();
  await acceptRow.getByTestId('OneLineEditor').nth(1).locator('.CodeMirror').click();
  await page.keyboard.type('text/event-stream');
  await expect.soft(requestPane.getByRole('button', { name: 'Connect' })).toBeVisible({ timeout: 5000 });

  // The request is an Event Stream now, but the response pane still shows the HTTP response it
  // received - its own tabs and its body - instead of the events view.
  await expect.soft(responsePane.getByRole('tab', { name: 'Preview' })).toBeVisible();
  await expect.soft(responseBody).toContainText('"id"');
});

test('Event Stream: connecting shows the received events in the events view', async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const requestPane = page.getByTestId('request-pane');

  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
  await page.getByRole('menuitemradio', { name: 'From Curl' }).click();
  await page
    .getByRole('dialog')
    .locator('.CodeMirror textarea')
    .fill(`curl --url http://127.0.0.1:4010/sse -H 'Accept: text/event-stream'`);
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await expect.soft(requestPane.getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/sse')).toBeVisible();

  await requestPane.getByRole('button', { name: 'Connect' }).click();

  const responsePane = page.getByTestId('response-pane').first();
  await expect.soft(responsePane.getByTestId('response-status-tag')).toContainText('200', { timeout: 10_000 });
  // The events view is what renders a stream response - the raw body would only show the NDJSON log.
  await expect.soft(responsePane.getByRole('tab', { name: 'Events' })).toBeVisible();
  await expect.soft(responsePane.getByRole('columnheader', { name: 'Data' })).toBeVisible();
  await expect.soft(responsePane.getByText('hello-from-sse-1')).toBeVisible();
  await expect.soft(responsePane.getByText('hello-from-sse-2')).toBeVisible();
});
