import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can backup data on new version available', async ({ app, page }) => {

    const dataPath = await app.evaluate(async ({ app }) => app.getPath('userData'));

    let foundBackups = false;
    // retry 5 times
    for (let i = 0; i < 5; i++) {
        console.log('Retry', i);
        if (fs.existsSync(path.join(dataPath, 'backups'))) {
            console.log('Backups exists!');
            foundBackups = true;
            break;
        } else {
            console.log('backups not found. Waiting 5 seconds...');
            await page.waitForTimeout(5000);
        }
    }

    await expect(foundBackups).toBe(true);
});
