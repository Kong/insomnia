import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Regression tests for https://github.com/Kong/insomnia/issues/9951
// On Linux, launching from a .desktop entry (or any context without a writable stdout)
// could crash the main process via an async EPIPE error event on process.stdout.
test.describe('stdout EPIPE resilience', () => {
  test('EPIPE error handler is registered on process.stdout at startup', async ({ app }) => {
    const listenerCount = await app.evaluate(() => process.stdout.listenerCount('error'));
    expect.soft(listenerCount).toBeGreaterThan(0);
  });

  test('app survives an async EPIPE error on stdout', async ({ app }) => {
    // Schedule the emit via nextTick so it fires outside evaluate()'s synchronous
    // context — mirroring the real scenario where EPIPE arrives as an async I/O
    // event from the OS. Without the fix, the throw escapes into the event loop
    // as an uncaught exception and crashes the main process.
    await app.evaluate(() => {
      process.nextTick(() => {
        const err: NodeJS.ErrnoException = new Error('write EPIPE');
        err.code = 'EPIPE';
        process.stdout.emit('error', err);
      });
    });

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
