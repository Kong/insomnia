/**
 * Example exec script — the escape hatch in its intended form.
 *
 *   node .claude/skills/run-insomnia/drive.mjs exec .claude/skills/run-insomnia/scripts/example-flow.ts
 *
 * Because the driver bundles `.ts` scripts with esbuild before importing them,
 * this can pull in the smoke suite's maintained Page Objects instead of
 * re-deriving selectors, and use the full Playwright API directly.
 *
 * Everything below runs in ONE round trip. The same flow expressed as
 * individual `drive.mjs` ops would be ~10 separate process spawns.
 */
import type { ElectronApplication, Page } from '@playwright/test';

import { InsomniaApp } from '@repo/packages/insomnia-smoke-test/playwright/pages';

interface Ctx {
  page: Page;
  app: ElectronApplication;
  expect: typeof import('@playwright/test').expect;
  log: (...xs: unknown[]) => void;
  ops: Record<string, (args?: Record<string, unknown>) => Promise<unknown>>;
}

export default async ({ page, app, expect, log, ops }: Ctx) => {
  const insomnia = new InsomniaApp(page, app);

  await insomnia.projectPage.importFixture('smoke-test-collection.yaml');
  log('imported smoke-test-collection.yaml');

  await insomnia.navigationSidebar.clickRequestOrFolder('send JSON request');

  const requestPane = page.getByTestId('request-pane');
  const statusTag = page.getByTestId('response-pane').getByTestId('response-status-tag');

  await requestPane.getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  log('sent "send JSON request" ->', await statusTag.innerText());

  // Native Playwright API the op vocabulary never exposed: response interception.
  const timings = await page.evaluate(() => performance.now());
  log('renderer uptime ms:', Math.round(timings));

  await ops.screenshot({ name: 'example-flow' });

  // Cross-check the UI against what actually landed in NeDB.
  const responses = (await ops.db({ type: 'Response', fields: ['statusCode', 'url'] })) as {
    docs: { statusCode: number; url: string }[];
  };

  return {
    requestCount: await page.getByTestId('request-pane').count(),
    persistedResponses: responses.docs,
  };
};
