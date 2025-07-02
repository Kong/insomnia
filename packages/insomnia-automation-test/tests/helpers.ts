import fs from 'fs';
import { Page } from '@playwright/test';

export const INSOMNIA_DATA_PATH = 'test-data/insomnia-data';

export const setup = async (page: Page) => {
    // Create clean test directory
    if (fs.existsSync(INSOMNIA_DATA_PATH)) {
        fs.rmdirSync(INSOMNIA_DATA_PATH, { recursive: true });
    }
    fs.mkdirSync(INSOMNIA_DATA_PATH, { recursive: true });

    // Skip onboarding
    await page.goto('insomnia://');
    if (await page.getByText('Get Started').isVisible()) {
        await page.getByRole('button', { name: 'Get Started' }).click();
        await page.getByRole('button', { name: 'Create' }).click();
        await page.getByRole('button', { name: 'Skip' }).click();
        await page.getByRole('button', { name: 'New Project' }).click();
        await page.getByRole('button', { name: 'Close' }).click();
    }

    // Wait for app ready
    await page.waitForSelector('.app');
};