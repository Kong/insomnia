import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Regression tests for https://github.com/Kong/insomnia/issues/9951 and #10544
// Launching without a writable stdout/stderr (e.g. from a .desktop entry on Linux)
// could crash the main process via an async EPIPE error event on those streams.
for (const streamName of ['stdout', 'stderr'] as const) {
  test.describe(`${streamName} EPIPE resilience`, () => {
    test(`EPIPE error handler is registered on process.${streamName} at startup`, async ({ app }) => {
      const listenerCount = await app.evaluate((_, name) => process[name].listenerCount('error'), streamName);
      expect.soft(listenerCount).toBeGreaterThan(0);
    });

    test(`app survives an async EPIPE error on ${streamName}`, async ({ app }) => {
      // Schedule the emit via nextTick so it fires outside evaluate()'s synchronous
      // context — mirroring the real scenario where EPIPE arrives as an async I/O
      // event from the OS. Without the fix, the throw escapes into the event loop
      // as an uncaught exception and crashes the main process.
      await app.evaluate((_, name) => {
        process.nextTick(() => {
          const err: NodeJS.ErrnoException = new Error('write EPIPE');
          err.code = 'EPIPE';
          process[name].emit('error', err);
        });
      }, streamName);

      // Flush the main-process event loop before asserting — setImmediate fires
      // after all I/O events in the current iteration, confirming the error event
      // was fully handled without triggering an uncaught exception.
      await app.evaluate(() => new Promise<void>(resolve => setImmediate(resolve)));

      // The app must still be alive. If the main process crashed from an uncaught
      // EPIPE exception, evaluate() would throw with a "Target closed" error.
      const alive = await app.evaluate(() => true);
      expect.soft(alive).toBe(true);
    });
  });
}
