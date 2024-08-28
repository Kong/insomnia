import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
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

    test('run collection runner', async ({ page }) => {
        await page.getByTestId('run-collection-btn-quick').click();

        // select requests to test
        await page.locator('text=Select All').click();
        await page.locator('#runner-request-list').getByRole('gridcell', { name: 'req3' }).locator('.react-aria-Checkbox').click();

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
        await verifyTestCounts(6, 8);

        const expectedTestOrder = [
            'folder-pre-check',
            'req1-pre-check',
            'req1-pre-check-skipped',
            'folder-post-check',
            'req1-post-check',
            'expected 200 to deeply equal 201',
            'req2-pre-check',
            'req2-post-check',
        ];

        const verifyResultRows = async (
            expectedPassed: number,
            expectedSkipped: number,
            expectedTotal: number,
            expectedTestOrder: string[],
        ) => {
            let passedResultCount = 0;
            let failedResultCount = 0;
            let skippedResultCount = 0;

            const testResults = page.getByTestId('test-result-row');
            const testResultCount = await testResults.count();

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
        await verifyResultRows(6, 1, 8, expectedTestOrder);
    });
});
