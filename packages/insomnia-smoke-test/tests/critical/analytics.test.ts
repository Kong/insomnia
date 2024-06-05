import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

interface SegmentRequestData {
    batch: {
        timestamp: string;
        integrations: {};
        type: string;
        properties: {};
        name?: string;
        context: {
            app: {
                name: string;
                version: string;
            };
            os: {
                name: string;
                version: string;
            };
            library: {
                name: string;
                version: string;
            };
        };
        anonymousId: string;
        userId: string;
        messageId: string;
        _metadata: {
            nodeVersion: string;
            jsRuntime: string;
        };
        event?: string;
    }[];
    writeKey: string;
    sentAt: string;
}

interface SegmentLog {
    url: string;
    data: SegmentRequestData[];
}

test('analytics events are sent', async ({ page, app }) => {
    // const netLogPath = path.join(dataPath, 'netlog.tmp');

    await app.evaluate(async ({ session }) => {
        global.segmentLogs = [];
        session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
            if (details.url.includes('segment')) {
                console.log('segment event', details.url);
                console.log('segment event data', details.uploadData);
                globalThis.segmentLogs.push({ url: details.url, data: details.uploadData });
            }
            callback({ cancel: false });
        });
    });

    // actions cause analytics events:
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // TODO(filipe) - check for userID and anonymousID, logout and then check for anonymousID only?

    const segmentLogs = await app.evaluate(() => globalThis.segmentLogs);
    const decodedLogs: SegmentLog[] = segmentLogs.map((log: { url: string; data: { type: string; bytes: number[] }[] }) => {
        return {
            url: log.url,
            data: log.data.map(data => JSON.parse(Buffer.from(Object.values(data.bytes)).toString('utf-8'))),
        };
    });

    expect(decodedLogs).not.toHaveLength(0);
});
