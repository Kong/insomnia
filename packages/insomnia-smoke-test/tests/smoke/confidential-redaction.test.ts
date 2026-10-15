import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// End-to-end check that confidential values never reach disk while
// "Hide Confidential values in Preview/Console" is on (its default).
//
// Unit tests cover the redaction helpers, but nothing covers the wiring: the collector is
// built in the send route, filled from several places (environment pre-fill, vault decrypt,
// tag execution, post-script registration) and consumed at two very different write points
// (the timeline file and the Response document). This test drives the real app and then reads
// what actually landed on disk.
//
// The two fixture secrets probe different registration paths:
//   - confidential-value-alpha exists before the request runs (pre-fill + render-time registration)
//   - confidential-value-rotated is written by the after-response script, which no render follows,
//     so only the post-script registration can catch it
const EXISTING_VALUE = 'confidential-value-alpha';
const ROTATED_VALUE = 'confidential-value-rotated';
const MASK = '••••••';
// The derived form of the confidential ws request's credentials. Computed rather than
// written out, so it cannot drift from the fixture if EXISTING_VALUE ever changes.
const BASIC_AUTH_BASE64 = Buffer.from(`user:${EXISTING_VALUE}`, 'utf8').toString('base64');

// Reads every timeline file, not just the newest: a chained request writes one timeline for
// itself and another for the dependent request it re-sends, and both have to be clean.
const readAllTimelines = (dataPath: string) => {
  const responsesDir = path.join(dataPath, 'responses');
  const timelines = fs.readdirSync(responsesDir).filter(name => name.endsWith('.timeline'));

  expect.soft(timelines, 'the request should have written a timeline file').not.toHaveLength(0);

  return timelines.map(name => fs.readFileSync(path.join(responsesDir, name), 'utf8')).join('\n');
};

// Imports the fixture, marks `token` confidential through the editor, and sends the request.
// Identical in both specs below, so the only variable between them is the setting.
const importAndMarkConfidential = async (app: any, page: Page) => {
  const text = await loadFixture('confidential-redaction-collection.yaml');
  await app.evaluate(async ({ clipboard }: any, text: string) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  // Imported environments arrive as JSON, so switch to the table view first -- that
  // conversion is what generates the kvPairData rows the lock icon acts on.
  await page.getByLabel('Select an API Collection Environment').click();
  await page.getByRole('button', { name: 'Manage API collection environments' }).click();
  await page.getByRole('button', { name: 'Table Edit' }).click();
  await page.getByRole('listbox', { name: 'Environment Key Value Pair' }).waitFor({ state: 'visible' });

  const closeButton = page.getByRole('button', { name: 'Close', exact: true });
  await page.getByRole('button', { name: 'Mark variable as confidential' }).first().click();
  // Each row commit is an async round-trip; Close is disabled while one is in flight.
  await expect.soft(closeButton).toBeEnabled();
  await expect.soft(page.getByRole('button', { name: 'Mark variable as not confidential' })).toHaveCount(1);

  await closeButton.click();
  await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });
  await page.getByLabel('Manage API collection environments').press('Escape');
};

const runRedactionRequest = async (app: any, page: Page, insomnia: any) => {
  await importAndMarkConfidential(app, page);

  await insomnia.navigationSidebar.clickRequestOrFolder('redaction request');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

  return page.getByTestId('response-pane').getByTestId('CodeEditor').locator('.CodeMirror-line').allInnerTexts();
};

test.describe('confidential value redaction', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('redacts the timeline file and the response document', async ({ app, page, dataPath, insomnia }) => {
    const body = await runRedactionRequest(app, page, insomnia);

    // Redaction is about what is written locally, never about what goes over the wire.
    // The echo server reflects request headers, so this proves the real value was sent.
    expect.soft(body.join(' '), 'the request must still be sent with the real value').toContain(EXISTING_VALUE);

    const timeline = readAllTimelines(dataPath);
    expect.soft(timeline, 'the timeline should show the mask').toContain(MASK);
    expect
      .soft(timeline, 'the pre-existing confidential value must not reach the timeline')
      .not.toContain(EXISTING_VALUE);
    expect
      .soft(timeline, 'the value written by the after-response script must not reach the timeline')
      .not.toContain(ROTATED_VALUE);

    // The Response document is persisted separately from the timeline and carries the
    // effective URL, the error message and the test results.
    const responseDb = fs.readFileSync(path.join(dataPath, 'insomnia.Response.db'), 'utf8');
    expect.soft(responseDb, 'the effective URL must not persist the confidential value').not.toContain(EXISTING_VALUE);
    expect.soft(responseDb, 'the assertion message must not persist the confidential value').not.toContain(
      ROTATED_VALUE,
    );
  });

  // The template tag's dependent-request path is a separate send implementation: it renders
  // with purpose 'send' and writes its own timeline and Response document, outside the main
  // send route's collector. The OAuth2 token request, the mock send and plugin sendRequest
  // all share that shape.
  test('redacts the timeline of a request re-sent by a template tag', async ({ app, page, dataPath, insomnia }) => {
    await runRedactionRequest(app, page, insomnia);

    await insomnia.navigationSidebar.clickRequestOrFolder('chained request');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

    const timelines = readAllTimelines(dataPath);
    expect
      .soft(timelines, 'the dependent request re-sent by the tag must not leak into its own timeline')
      .not.toContain(EXISTING_VALUE);
    expect.soft(timelines, 'nor the value the after-response script wrote').not.toContain(ROTATED_VALUE);
  });

  // The Basic Auth header is base64(user:pass), which does not contain the plaintext
  // password, so it is not covered by the values the renderer registered. The main process
  // has to register that derived form itself -- but only when an input really was
  // confidential, or it masks credentials nobody marked. This spec pins the first half;
  // websocket.test.ts, which asserts a literal credential stays readable, pins the second.
  test('redacts a Basic Auth header derived from a confidential value', async ({ app, page, dataPath, insomnia }) => {
    await importAndMarkConfidential(app, page);

    await insomnia.navigationSidebar.clickRequestOrFolder('confidential ws');
    await page.getByText('Connect', { exact: true }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText(
      '101 Switching Protocols',
    );
    await page.getByRole('tab', { name: 'Console' }).click();

    const timelines = readAllTimelines(dataPath);
    expect.soft(timelines, 'the base64 of the confidential credentials must not reach disk').not.toContain(
      BASIC_AUTH_BASE64,
    );
    expect.soft(timelines, 'the header should be masked instead').toContain(`authorization: ${MASK}`);
  });

  // Negative control for the spec above: with the setting off, the identical flow must write
  // the same values to disk in plaintext. That is the documented, asymmetric-by-design
  // behaviour -- turning the setting off persists secrets locally, it is not just a visual
  // reveal -- and it is also what keeps the spec above from passing vacuously.
  test('writes plaintext to the timeline when the setting is off', async ({ app, page, dataPath, insomnia }) => {
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // click + poll rather than uncheck(): the checkbox is controlled by the root loader's
    // settings, so it only flips once the patch has round-tripped. uncheck() verifies the
    // state immediately after its click and fails on that gap.
    const hideSecretValues = page.getByLabel('Hide Confidential values in Preview/Console');
    await hideSecretValues.click();
    await expect.soft(hideSecretValues).not.toBeChecked();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    await runRedactionRequest(app, page, insomnia);

    const timeline = readAllTimelines(dataPath);
    expect.soft(timeline, 'the setting is off, so nothing should be masked').not.toContain(MASK);
    expect.soft(timeline, 'the pre-existing value is written in plaintext').toContain(EXISTING_VALUE);
    expect.soft(timeline, 'the value written by the after-response script is too').toContain(ROTATED_VALUE);
  });
});
