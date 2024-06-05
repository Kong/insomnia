import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('analytics events are sent', async ({ page, app, dataPath }) => {
    const netLogPath = path.join(dataPath, 'netlog.tmp');

    await writeFile(netLogPath, '');

    await app.evaluate(async ({ netLog }, netLogPath) => {
        await netLog.startLogging(netLogPath);
    }, netLogPath);

    // actions cause analytics events:
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // TODO(filipe) - check for userID and anonymousID, logout and then check for anonymousID only?

    await app.evaluate(async ({ netLog }) => {
        await netLog.stopLogging();
    });

    const logsFileContents = await readFile(netLogPath, 'utf-8');

    const logs = JSON.parse(logsFileContents) as { events: { params?: { url: string } }[] };

    // @TODO - more checks?
    const analyticsEvents = logs.events.filter(event => event.params?.url?.includes('segment'));
    expect(analyticsEvents).not.toHaveLength(0);

    await rm(netLogPath);
});
