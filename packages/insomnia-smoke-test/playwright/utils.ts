import { ElectronApplication } from '@playwright/test';

import config from '../playwright.config';

export async function getLoadedPage(app: ElectronApplication, pageHTMLTitle: string) {
    const pollingInterval = 500;
    const timeoutMs = config.timeout;

    if (!timeoutMs) {
        throw Error('timeout is undefined in playwright.config.ts, probably the config is modifed.');
    }

    let targetPage = undefined;

    for (let i = 0; i < timeoutMs / pollingInterval; i++) {
        const pages = app.windows();

        for (const page of pages) {
            if (await page.title() === pageHTMLTitle) {
                targetPage = page;
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }

    if (!targetPage) {
        throw Error(`page (${pageHTMLTitle}) is not loaded until ${timeoutMs}ms, please manually launch app and check why`);
    }

    await targetPage.waitForLoadState();
    return targetPage;
};
