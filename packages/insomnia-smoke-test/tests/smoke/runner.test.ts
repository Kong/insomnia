import { expect, type Page } from '@playwright/test';

import { getFixturePath } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('runner features tests', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ page, insomnia }) => {
    await insomnia.projectPage.importFixture('runner-collection.yaml');
    await insomnia.statusbar.openPreferences();
    await page.getByText('Use vertical layout').click();
    await page.locator('.app').press('Escape');
  });

  const verifyResultRows = async (
    page: Page,
    expectedPassed: number,
    expectedSkipped: number,
    expectedTotal: number,
    expectedTestOrder: string[],
    iteration = 1,
  ) => {
    let passedResultCount = 0;
    let failedResultCount = 0;
    let skippedResultCount = 0;

    const testResults = page.getByTestId(`runner-test-result-iteration-${iteration}`).getByTestId('test-result-row');
    const testResultCount = await testResults.count();

    expect.soft(expectedTestOrder.length).toEqual(testResultCount);

    for (let i = 0; i < testResultCount; i++) {
      const resultMsg = await testResults.nth(i).textContent();
      if (resultMsg?.startsWith('PASS')) {
        passedResultCount++;
      }
      if (resultMsg?.startsWith('FAIL')) {
        failedResultCount++;
      }
      if (resultMsg?.startsWith('SKIP')) {
        skippedResultCount++;
      }

      const expectedResultText = expectedTestOrder[i];
      expect.soft(resultMsg).toContain(expectedResultText);
    }
    expect.soft(passedResultCount).toEqual(expectedPassed);
    expect.soft(skippedResultCount).toEqual(expectedSkipped);
    expect.soft(passedResultCount + failedResultCount + skippedResultCount).toEqual(expectedTotal);
  };

  test('run collection runner', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    // select requests to test
    await page.locator('.runner-request-list-req1').click();
    await page.locator('.runner-request-list-req2').click();

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();

    // verification
    const verifyTestCounts = async (expectedPassed: number, expectedTotal: number) => {
      await page.getByText('Req2-Pre-Check').click();

      const testResultCounts = await page.locator('.test-result-count').allInnerTexts();
      expect.soft(testResultCounts.length).toBe(1);

      const countParts = testResultCounts[0].split('/');
      expect.soft(countParts.length).toBe(2);

      const summarizedPassedCount = Number.parseInt(countParts[0], 10);
      const summarizedTotalCount = Number.parseInt(countParts[1], 10);
      expect.soft(summarizedPassedCount).toEqual(expectedPassed);
      expect.soft(summarizedTotalCount).toEqual(expectedTotal);
    };
    await page.getByText('6 / 8').click();
    await verifyTestCounts(6, 8);

    const expectedTestOrder = [
      'folder-pre-check',
      'req1-pre-check-skipped',
      'req1-pre-check',
      'folder-post-check',
      'req1-post-check',
      'expected 200 to deeply equal 201',
      'req2-pre-check',
      'req2-post-check',
    ];

    await verifyResultRows(page, 6, 1, 8, expectedTestOrder);
  });

  test('run collection runner with data upload', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    // upload data
    await page.getByText('Upload Data').click();
    const uploadDataPath = getFixturePath('files/runner-data.json');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Select Data File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadDataPath);
    await page.getByRole('dialog').getByText('Upload').click();
    // check iteration number match json data length
    await expect.soft(page.locator('input[name="Iterations"]')).toHaveValue('2');

    // select requests to test
    await page.locator('.runner-request-list-req1').click();
    await page.locator('.runner-request-list-req2').click();
    await page.locator('.runner-request-list-req3').click();
    await page.locator('.runner-request-list-req4').click();
    await page.locator('.runner-request-list-req5').click();

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();
    // check result
    await page.getByText('ITERATION 1').click();
    for (let i = 1; i <= 2; i++) {
      const testId = `runner-test-result-iteration-${i}`;
      const iterationTestResultElement = page.getByTestId(testId);
      await iterationTestResultElement.click();
      await expect.soft(iterationTestResultElement).toBeVisible();
      // req2 should be skipped from pre-request script
      await expect.soft(iterationTestResultElement).not.toContainText('req2');
    }

    await verifyResultRows(page, 4, 1, 6, [
      'folder-pre-check',
      'req1-pre-check-skipped',
      'req1-pre-check',
      'folder-post-check',
      'req1-post-check',
      'expected 200 to deeply equal 201',
    ]);
  });

  test('run req4 3 times with setNextRequest the pre-request script', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-req4').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['req4-post-check', 'req4-post-check', 'req4-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('await test works', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-await-test').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('0 / 3').first().click();

    const expectedTestOrder = ['t1', 't2', 't3'];

    await verifyResultRows(page, 0, 0, 3, expectedTestOrder, 1);
  });

  test('run req5 3 times with setNextRequest in the after-response script', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-req5').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['req5-post-check', 'req5-post-check', 'req5-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('skip req01 with setNextRequest', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-req0').click();
    await page.locator('.runner-request-list-req01').click();
    await page.locator('.runner-request-list-req02').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('1 / 2').first().click();

    const expectedTestOrder = [
      'req0-post-check',
      // 'req01-post-check' is skipped
      'req02-post-check',
    ];

    await verifyResultRows(page, 1, 1, 2, expectedTestOrder, 1);
  });

  test('can read variables during whole execution', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-set-var1').click();
    await page.locator('.runner-request-list-read-var1').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['set-var1-check', 'read-var1-pre-check', 'read-var1-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('can detect sync and async test failure', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-async-test').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('0 / 4').first().click();

    const expectedTestOrder = ['sync_pre_test', 'async_pre_test', 'sync_post_test', 'async_post_test'];

    await verifyResultRows(page, 0, 0, 4, expectedTestOrder, 1);
  });

  test('iterations input can be cleared to enter a new value', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    const iterationsInput = page.locator('input[name="Iterations"]');

    // default value should be 1
    await expect.soft(iterationsInput).toHaveValue('1');

    // clear the input
    await iterationsInput.clear();
    await expect.soft(iterationsInput).toHaveValue('');

    // type a new value
    await iterationsInput.fill('3');
    await expect.soft(iterationsInput).toHaveValue('3');
  });

  test('running with cleared iterations input uses last valid value', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    const iterationsInput = page.locator('input[name="Iterations"]');

    // set a valid iteration count
    await iterationsInput.fill('2');
    await expect.soft(iterationsInput).toHaveValue('2');

    // clear the input without entering a new value
    await iterationsInput.clear();
    await expect.soft(iterationsInput).toHaveValue('');

    // select a request and run
    await page.locator('.runner-request-list-req1').click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();

    // should have run 2 iterations (last valid value)
    await expect.soft(page.getByTestId('runner-test-result-iteration-1')).toBeVisible();
    await expect.soft(page.getByTestId('runner-test-result-iteration-2')).toBeVisible();
    await expect.soft(page.getByTestId('runner-test-result-iteration-3')).toBeHidden();
  });

  test('settings: can turn off logs', async ({ page }) => {
    await page.getByTestId('run-collection-btn-quick').click();

    await page.locator('.runner-request-list-printLogs').click();
    await page.getByRole('tab', { name: 'advanced' }).click();
    await page.locator('input[name="enable-log"]').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // verify there's no log
    await page.getByText('1 / 1').first().click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.locator('.pane-two')).not.toContainText("it won't print");

    await page.getByRole('tab', { name: 'advanced' }).click();
    await page.locator('input[name="enable-log"]').click();

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // verify there's a log
    await page.getByText('1 / 1').first().click();
    await page.getByRole('tab', { name: 'Console' }).click();

    await expect.soft(page.locator('.pane-two')).toContainText("it won't print");
  });
});
