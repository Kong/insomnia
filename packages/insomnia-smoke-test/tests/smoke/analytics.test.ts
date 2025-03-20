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
    await app.evaluate(async ({ session }) => {
        // Capture segment requests to a global variable in main process
        globalThis.segmentLogs = [];

        session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
            if (details.url.includes('segment')) {
                globalThis.segmentLogs.push({ url: details.url, data: details.uploadData });
            }
            callback({ cancel: false });
        });
    });

    // Create a collection and requests that cause analytics events:
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    for (let i = 0; i < 10; i++) {
        await page.getByLabel('Create in collection').click();
        await page.getByRole('menuitemradio', { name: 'HTTP Request' }).press('Enter');
    }

    const segmentLogs = await app.evaluate(() => globalThis.segmentLogs);

    const decodedLogs: SegmentLog[] = segmentLogs.map((log: { url: string; data: { type: string; bytes: number[] }[] }) => {
        return {
            url: log.url,
            data: log.data.map(data => JSON.parse(Buffer.from(Object.values(data.bytes)).toString('utf-8'))),
        };
    });

    const analyticsBatch = decodedLogs[0].data[0].batch;
    const [appStartEvent, ...restEvents] = analyticsBatch;

    // Analytics need at least 15 events to be sent
    expect(analyticsBatch.length).toBeGreaterThanOrEqual(15);

    // App start event
    expect(appStartEvent.anonymousId).toBeTruthy();
    expect(appStartEvent.event).toBe('App Started');

    // First event should have userId and anonymousId
    expect(restEvents[0].anonymousId).toBeTruthy();
    expect(restEvents[0].userId).toBeTruthy();

    // Last event should have userId and anonymousId
    expect(restEvents.at(-1)?.anonymousId).toBeTruthy();
    expect(restEvents.at(-1)?.userId).toBeTruthy();

});
