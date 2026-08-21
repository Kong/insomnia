import type { RequestTestResult } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetTestPromises, skip, test, waitForAllTestsDone } from '../test';

describe('test / skip / waitForAllTestsDone', () => {
  beforeEach(() => {
    resetTestPromises();
  });

  it('logs a passed result for a passing test', async () => {
    const logs: RequestTestResult[] = [];

    await test('t1', async () => {}, r => logs.push(r));
    await waitForAllTestsDone();

    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('passed');
    expect(logs[0].testCase).toBe('t1');
    expect(typeof logs[0].executionTime).toBe('number');
    expect(logs[0].category).toBe('unknown');
  });

  it('logs a failed result with error details for a throwing test', async () => {
    const logs: RequestTestResult[] = [];

    await test('t2', async () => {
      throw Object.assign(new Error('boom'), { actual: 1, expected: 2 });
    }, r => logs.push(r));
    await waitForAllTestsDone();

    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('failed');
    expect(logs[0].errorMessage).toContain('boom');
    expect(logs[0].errorMessage).toContain('1');
    expect(logs[0].errorMessage).toContain('2');
  });

  it('logs a skipped result with executionTime 0', async () => {
    const logs: RequestTestResult[] = [];

    await skip('t3', async () => {}, r => logs.push(r));

    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('skipped');
    expect(logs[0].executionTime).toBe(0);
  });

  it('waitForAllTestsDone waits for all registered tests to complete', async () => {
    const logs: RequestTestResult[] = [];

    // A test that stays pending until we explicitly release it, so we can prove
    // waitForAllTestsDone blocks on it rather than relying on timer timing.
    let releaseSlow!: () => void;
    const slowPending = new Promise<void>(resolve => {
      releaseSlow = resolve;
    });

    test('slow', () => slowPending, r => logs.push(r));
    test('fast', async () => {}, r => logs.push(r));

    // The fast test can settle, but the slow test is still pending, so nothing is logged yet.
    await Promise.resolve();
    expect(logs.map(l => l.testCase)).not.toContain('slow');

    releaseSlow();
    await waitForAllTestsDone();

    expect(logs).toHaveLength(2);
    expect(logs.map(l => l.testCase).sort()).toEqual(['fast', 'slow']);
  });
});
