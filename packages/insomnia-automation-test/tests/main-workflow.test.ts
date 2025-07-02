import { test, expect } from '@playwright/test';
import { INSOMNIA_DATA_PATH, setup } from './helpers';

test.describe('Main Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await setup(page);
    });

    test('Create, send and validate request', async ({ page }) => {
        // Create new request
        await page.getByRole('button', { name: 'New' }).click();
        await page.getByRole('menuitem', { name: 'HTTP Request' }).click();
        await page.getByPlaceholder('My Request').fill('API Test Request');

        // Configure request
        await page.getByTestId('url-input').click();
        await page.getByTestId('url-input').fill('https://httpbin.org/get');
        await page.getByTestId('request-method').selectOption('GET');
        await page.getByRole('button', { name: 'Headers' }).click();
        await page.locator('[data-testid="header-pair"]').nth(0).getByTestId('key-value-input-key').fill('Accept');
        await page.locator('[data-testid="header-pair"]').nth(0).getByTestId('key-value-input-value').fill('application/json');

        // Send request and validate
        await page.getByTestId('request-pane-send-button').click();

        // Verify response
        await expect(page.getByTestId('response-status-tag')).toContainText('200 OK');
        await expect(page.locator('.response-pane')).toContainText('"url": "https://httpbin.org/get"');

        // Verify timeline
        await page.getByRole('tab', { name: 'Timeline' }).click();
        await expect(page.locator('.timeline-table')).toContainText('GET /get HTTP/1.1');
    });
});