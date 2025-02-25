import { expect, type Page } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';;

test.describe('runner features tests', async () => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    test.beforeEach(async ({ app, page }) => {
        const text = await loadFixture('runner-collection.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

        await page.getByLabel('Import').click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByLabel('Runner').click();
    });

    const verifyResultRows = async (
        page: Page,
        expectedPassed: number,
        expectedSkipped: number,
        expectedTotal: number,
        expectedTestOrder: string[],
        iteration: number = 1,
    ) => {
        let passedResultCount = 0;
        let failedResultCount = 0;
        let skippedResultCount = 0;

        const testResults = page.getByTestId(`runner-test-result-iteration-${iteration}`).getByTestId('test-result-row');
        const testResultCount = await testResults.count();

        expect(expectedTestOrder.length).toEqual(testResultCount);

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
            expect(resultMsg).toContain(expectedResultText);
        }
        expect(passedResultCount).toEqual(expectedPassed);
        expect(skippedResultCount).toEqual(expectedSkipped);
        expect(passedResultCount + failedResultCount + skippedResultCount).toEqual(expectedTotal);
    };

    test('run collection runner', async ({ page }) => {
        await page.getByTestId('run-collection-btn-quick').click();

        // select requests to test
        await page.locator('.runner-request-list-req1').click();
        await page.locator('.runner-request-list-req2').click();

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Run' }).click();

        // verification
        const verifyTestCounts = async (
            expectedPassed: number,
            expectedTotal: number,
        ) => {
            await page.getByText('Req2-Pre-Check').click();

            const testResultCounts = await page.locator('.test-result-count').allInnerTexts();
            expect(testResultCounts.length).toBe(1);

            const countParts = testResultCounts[0].split('/');
            expect(countParts.length).toBe(2);

            const summarizedPassedCount = parseInt(countParts[0], 10);
            const summarizedTotalCount = parseInt(countParts[1], 10);
            expect(summarizedPassedCount).toEqual(expectedPassed);
            expect(summarizedTotalCount).toEqual(expectedTotal);
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
        expect(await page.locator('input[name="Iterations"]').inputValue()).toBe('2');

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
            expect(iterationTestResultElement).toBeVisible();
            // req2 should be skipped from pre-request script
            expect(iterationTestResultElement).not.toContainText('req2');
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

        const expectedTestOrder = [
            'req4-post-check',
            'req4-post-check',
            'req4-post-check',
        ];

        await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
    });

    test('await test works', async ({ page }) => {
        await page.getByTestId('run-collection-btn-quick').click();

        await page.locator('.runner-request-list-await-test').click();

        // send
        await page.getByRole('button', { name: 'Run', exact: true }).click();

        // check result
        await page.getByText('0 / 3').first().click();

        const expectedTestOrder = [
            't1',
            't2',
            't3',
        ];

        await verifyResultRows(page, 0, 0, 3, expectedTestOrder, 1);
    });

    test('run req5 3 times with setNextRequest in the after-response script', async ({ page }) => {
        await page.getByTestId('run-collection-btn-quick').click();

        await page.locator('.runner-request-list-req5').click();

        // send
        await page.getByRole('button', { name: 'Run', exact: true }).click();

        // check result
        await page.getByText('3 / 3').first().click();

        const expectedTestOrder = [
            'req5-post-check',
            'req5-post-check',
            'req5-post-check',
        ];

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

        const expectedTestOrder = [
            'set-var1-check',
            'read-var1-pre-check',
            'read-var1-post-check',
        ];

        await verifyResultRows(page, 3, 0, 3, expectedTestOrder, 1);
    });

    test('can detect sync and async test failure', async ({ page }) => {
        await page.getByTestId('run-collection-btn-quick').click();

        await page.locator('.runner-request-list-async-test').click();

        // send
        await page.getByRole('button', { name: 'Run', exact: true }).click();

        // check result
        await page.getByText('0 / 4').first().click();

        const expectedTestOrder = [
            'sync_pre_test',
            'async_pre_test',
            'sync_post_test',
            'async_post_test',
        ];

        await verifyResultRows(page, 0, 0, 4, expectedTestOrder, 1);
    });

    test('settings: can turn off logs', async ({ page }) => {

        await page.getByTestId('run-collection-btn-quick').click();

        await page.locator('.runner-request-list-printLogs').click();

        const expectToHaveLogs = [false, true];

        for (const expectToHaveLog of expectToHaveLogs) {
            // configure
            await page.getByRole('tab', { name: 'advanced' }).click();
            await page.locator('input[name="enable-log"]').click();

            // send
            await page.getByRole('button', { name: 'Run', exact: true }).click();

            // verify there's no log
            await page.getByText('1 / 1').first().click();
            await page.getByRole('tab', { name: 'Console' }).click();

            const consoleTabContent = page.locator('.pane-two');
            if (expectToHaveLog) {
                expect(consoleTabContent).toContainText("it won't print");
            } else {
                expect(consoleTabContent).not.toContainText("it won't print");
            }
        }
    });
});
