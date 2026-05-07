import { describe, expect, it, vi } from 'vitest';

import { SyncQueue } from './sync-queue';

describe('SyncQueue', () => {
  it('executes tasks in FIFO order', async () => {
    const queue = new SyncQueue();
    const order: number[] = [];

    queue.enqueue(async () => {
      order.push(1);
    });
    queue.enqueue(async () => {
      order.push(2);
    });
    queue.enqueue(async () => {
      order.push(3);
    });

    await queue.waitUntilDone();

    expect(order).toEqual([1, 2, 3]);
  });

  it('runs at most one task at a time', async () => {
    const queue = new SyncQueue();
    let concurrent = 0;
    let maxConcurrent = 0;

    const makeTask = () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      concurrent--;
    };

    queue.enqueue(makeTask());
    queue.enqueue(makeTask());
    queue.enqueue(makeTask());

    await queue.waitUntilDone();

    expect(maxConcurrent).toBe(1);
  });

  it('waitUntilDone() resolves when all pending tasks are done', async () => {
    const queue = new SyncQueue();
    const completed: number[] = [];

    queue.enqueue(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      completed.push(1);
    });
    queue.enqueue(async () => {
      completed.push(2);
    });

    await queue.waitUntilDone();

    expect(completed).toEqual([1, 2]);
  });

  it('waitUntilDone() resolves immediately when queue is empty', async () => {
    const queue = new SyncQueue();
    await queue.waitUntilDone(); // should not hang
  });

  it('waitUntilDone() waits for tasks enqueued during processing', async () => {
    const queue = new SyncQueue();
    const completed: string[] = [];

    queue.enqueue(async () => {
      completed.push('first');
      // Enqueue more work while the queue is processing
      queue.enqueue(async () => {
        completed.push('second');
      });
    });

    await queue.waitUntilDone();

    expect(completed).toEqual(['first', 'second']);
  });

  it('catches errors without blocking subsequent tasks', async () => {
    const queue = new SyncQueue();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const completed: number[] = [];

    queue.enqueue(async () => {
      completed.push(1);
    });
    queue.enqueue(async () => {
      throw new Error('boom');
    });
    queue.enqueue(async () => {
      completed.push(3);
    });

    await queue.waitUntilDone();

    expect(completed).toEqual([1, 3]);
    expect(consoleSpy).toHaveBeenCalledWith('[sync-queue] Task error:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('stop() prevents new tasks from being processed', async () => {
    const queue = new SyncQueue();
    const completed: number[] = [];

    // Stop the queue first, before any tasks are enqueued
    queue.stop();

    queue.enqueue(async () => {
      completed.push(1);
    });
    queue.enqueue(async () => {
      completed.push(2);
    });

    // Give time for any async processing
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(completed).toEqual([]);
  });

  it('multiple waitUntilDone() calls all resolve together', async () => {
    const queue = new SyncQueue();
    const completed: number[] = [];

    queue.enqueue(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      completed.push(1);
    });

    const [r1, r2] = await Promise.all([queue.waitUntilDone(), queue.waitUntilDone()]);

    expect(r1).toBeUndefined();
    expect(r2).toBeUndefined();
    expect(completed).toEqual([1]);
  });
});
