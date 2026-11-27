/**
 * Throwaway probe: does anything actually slow Insomnia's network down?
 *
 * Times an identical renderer-side fetch under three conditions, so a no-op is
 * distinguishable from "worked but I measured the wrong thing".
 */
import type { ElectronApplication, Page } from '@playwright/test';

interface Ctx {
  page: Page;
  app: ElectronApplication;
  log: (...xs: unknown[]) => void;
}

/** Any endpoint the app itself would call. Taken from whichever profile is
 *  running, so this probe works on mock as well as a real backend. */
const PROBE_PATH = '/v1/billing/current-plan';

export default async ({ page, app, log }: Ctx) => {
  const apiBase = await page.evaluate(() => window.env?.INSOMNIA_API_URL || 'https://api.insomnia.rest');
  const urlUnderTest = apiBase + PROBE_PATH;
  log('probing', urlUnderTest);

  const time = async (label: string) => {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ms = await page.evaluate(async url => {
        const t0 = performance.now();
        try {
          await fetch(url, { cache: 'no-store' });
        } catch {
          /* status doesn't matter, timing does */
        }
        return Math.round(performance.now() - t0);
      }, `${urlUnderTest}?cachebust=${Date.now()}_${i}`);
      samples.push(ms);
    }
    log(label.padEnd(34), samples.join('ms, ') + 'ms');
    return samples;
  };

  await time('baseline');

  // 1. Electron Session API
  await app.evaluate(({ session }) =>
    session.defaultSession.enableNetworkEmulation({ latency: 1500, downloadThroughput: -1, uploadThroughput: -1 }),
  );
  await time('session.enableNetworkEmulation');
  await app.evaluate(({ session }) => session.defaultSession.disableNetworkEmulation());

  // 2. CDP via the renderer's own debugger. Playwright is already attached over
  //    CDP, so this may well refuse — that result is itself worth knowing.
  let cdp = 'not attempted';
  try {
    cdp = await app.evaluate(async ({ BrowserWindow }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents;
      try {
        wc.debugger.attach('1.3');
      } catch (e) {
        return 'attach failed: ' + (e as Error).message;
      }
      await wc.debugger.sendCommand('Network.enable');
      await wc.debugger.sendCommand('Network.emulateNetworkConditions', {
        offline: false,
        latency: 1500,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      return 'attached';
    });
  } catch (e) {
    cdp = 'threw: ' + (e as Error).message;
  }
  log('cdp attach ->', cdp);

  if (cdp === 'attached') {
    await time('CDP emulateNetworkConditions');
    await app.evaluate(({ BrowserWindow }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents;
      try {
        wc.debugger.detach();
      } catch {}
    });
  }

  return { cdp };
};
