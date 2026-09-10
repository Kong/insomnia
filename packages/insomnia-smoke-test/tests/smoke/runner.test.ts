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

    expect.soft(expectedTestOrder).toHaveLength(testResultCount);

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

  const selectRunnerRequests = async (page: Page, ...names: string[]) => {
    await page.getByText('Unselect All').click();
    for (const name of names) {
      const row = page.locator(`.runner-request-list-${name}`);
      await row.waitFor({ state: 'visible' });
      await row.locator('label[slot="selection"]').click();
    }
  };

  test('run collection runner', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'req1', 'req2');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();

    // verification
    const verifyTestCounts = async (expectedPassed: number, expectedTotal: number) => {
      await page.getByText('Req2-Pre-Check').click();

      const testResultCounts = await page.locator('.test-result-count').allInnerTexts();
      expect.soft(testResultCounts).toHaveLength(1);

      const countParts = testResultCounts[0].split('/');
      expect.soft(countParts).toHaveLength(2);

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

  test('shows live progress and cancels an in-progress run', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'delaySkip', 'fastAfterSkip');

    await page.getByRole('button', { name: 'Run', exact: true }).click();

    await expect.soft(page.getByRole('button', { name: 'Cancel all' })).toBeVisible();
    await expect.soft(page.getByTestId('runner-live-item-delaySkip')).toContainText('RUNNING');
    await expect.soft(page.getByTestId('runner-live-item-fastAfterSkip')).toContainText('PENDING');

    // the templated URL is resolved (like the request view's preview) while the request runs
    await expect.soft(page.getByTestId('runner-live-item-delaySkip')).toContainText('127.0.0.1:4010/delay/seconds/10');
    await expect.soft(page.getByTestId('runner-live-item-delaySkip')).not.toContainText('{{');

    await page.getByRole('button', { name: 'Cancel all' }).click();
    await expect.soft(page.getByTestId('runner-live-item-delaySkip')).toContainText('CANCELED', { timeout: 8000 });
  });

  test('skips the in-flight request and continues to the next', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'delaySkip', 'fastAfterSkip');

    await page.getByRole('button', { name: 'Run', exact: true }).click();

    const delayCard = page.getByTestId('runner-live-item-delaySkip');
    await expect.soft(delayCard).toContainText('RUNNING');
    await delayCard.getByRole('button', { name: 'Skip' }).click();

    // the fast request lands well under the 10s delay, proving the slow one was actually aborted
    await expect.soft(page.getByText('fastAfterSkip-post-check')).toBeVisible({ timeout: 8000 });
    await expect.soft(page.getByText('delaySkip-post-check')).toBeHidden();
  });

  test('run collection runner with data upload', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });
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

    await selectRunnerRequests(page, 'req1', 'req2', 'req3', 'req4', 'req5');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();
    // check result
    await page.getByText('ITERATION 1').click();
    for (let i = 1; i <= 2; i++) {
      const testId = `runner-test-result-iteration-${i}`;
      const iterationTestResultElement = page.getByTestId(testId);
      await iterationTestResultElement.click();
      await expect.soft(iterationTestResultElement).toBeVisible();
      await expect.soft(iterationTestResultElement.getByTestId('request-test-result-1')).toContainText('SKIPPED');
      await expect.soft(iterationTestResultElement.getByTestId('request-test-result-2')).toContainText('SKIPPED');
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

  test('run req4 3 times with setNextRequest the pre-request script', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });
    await selectRunnerRequests(page, 'req4');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['req4-post-check', 'req4-post-check', 'req4-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('await test works', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });
    await selectRunnerRequests(page, 'await-test');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('0 / 3').first().click();

    const expectedTestOrder = ['t1', 't2', 't3'];

    await verifyResultRows(page, 0, 0, 3, expectedTestOrder, 1);
  });

  test('run req5 3 times with setNextRequest in the after-response script', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });
    await selectRunnerRequests(page, 'req5');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['req5-post-check', 'req5-post-check', 'req5-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('skip req01 with setNextRequest', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });
    await selectRunnerRequests(page, 'req0', 'req01', 'req02');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('1 / 2').first().click();
    await expect.soft(page.getByTestId('request-test-result-1')).toContainText('SKIPPED');

    const expectedTestOrder = [
      'req0-post-check',
      // 'req01-post-check' is skipped
      'req02-post-check',
    ];

    await verifyResultRows(page, 1, 1, 2, expectedTestOrder, 1);
  });

  test('can read variables during whole execution', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'set-var1', 'read-var1');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('3 / 3').first().click();

    const expectedTestOrder = ['set-var1-check', 'read-var1-pre-check', 'read-var1-post-check'];

    await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
  });

  test('can detect sync and async test failure', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'async-test');

    // send
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // check result
    await page.getByText('0 / 4').first().click();

    const expectedTestOrder = ['sync_pre_test', 'async_pre_test', 'sync_post_test', 'async_post_test'];

    await verifyResultRows(page, 0, 0, 4, expectedTestOrder, 1);
  });

  test('delay input can be cleared to enter a new value', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    const delayInput = page.locator('input[name="Delay"]');

    // default value should be 0
    await expect.soft(delayInput).toHaveValue('0');

    // clear the input
    await delayInput.clear();
    await expect.soft(delayInput).toHaveValue('');

    // type a new value
    await delayInput.fill('500');
    await expect.soft(delayInput).toHaveValue('500');
  });

  test('running with cleared delay input uses last valid value', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    const delayInput = page.locator('input[name="Delay"]');

    // set a valid delay
    await delayInput.fill('100');
    await expect.soft(delayInput).toHaveValue('100');

    // clear the input without entering a new value
    await delayInput.clear();
    await expect.soft(delayInput).toHaveValue('');

    // blur the input - it should restore to last valid value
    await delayInput.blur();
    await expect.soft(delayInput).toHaveValue('100');
  });

  test('iterations input can be cleared to enter a new value', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

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

  test('running with cleared iterations input uses last valid value', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    const iterationsInput = page.locator('input[name="Iterations"]');

    // set a valid iteration count
    await iterationsInput.fill('2');
    await expect.soft(iterationsInput).toHaveValue('2');

    // clear the input without entering a new value
    await iterationsInput.clear();
    await expect.soft(iterationsInput).toHaveValue('');

    await selectRunnerRequests(page, 'req1');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();

    // should have run 2 iterations (last valid value)
    await expect.soft(page.getByTestId('runner-test-result-iteration-1')).toBeVisible();
    await expect.soft(page.getByTestId('runner-test-result-iteration-2')).toBeVisible();
    await expect.soft(page.getByTestId('runner-test-result-iteration-3')).toBeHidden();
  });

  test('can turn off logs via settings', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Run API Collection',
      workspaceName: 'Runner',
    });

    await selectRunnerRequests(page, 'printLogs');

    await page.getByRole('tab', { name: 'advanced' }).click();
    await page.locator('input[name="enable-log"]').click();

    const runButton = page.getByRole('button', { name: 'Run', exact: true });
    await expect.soft(runButton).toBeEnabled();
    await runButton.click();

    // verify there's no log
    await page.getByText('1 / 1').first().click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.locator('.pane-two')).not.toContainText("it won't print");

    await page.getByRole('tab', { name: 'advanced' }).click();
    await page.locator('input[name="enable-log"]').click();

    // send
    await runButton.click();

    // verify there's a log
    await page.getByText('1 / 1').first().click();
    await page.getByRole('tab', { name: 'Console' }).click();

    await expect.soft(page.locator('.pane-two')).toContainText("it won't print");
  });
});
