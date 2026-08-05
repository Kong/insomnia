/**
 * SyncQueue — Serial async task queue.
 *
 * Guarantees that enqueued async tasks execute one at a time in FIFO order.
 * Used by {@link RepoFileWatcher} to serialise FS→DB imports and DB→FS flushes,
 * eliminating race conditions between the two directions.
 *
 * Key features:
 *  - `enqueue(fn)` — adds a task; processing starts automatically.
 *  - `waitUntilDone()` — returns a promise that resolves once every task that
 *    was enqueued *at the time of the call* has finished. The git service calls
 *    this before git operations to ensure the working tree is up-to-date.
 *  - Error isolation — a failing task is logged but does not block subsequent tasks.
 *  - `stop()` — future `enqueue()` calls are no-ops and pending tasks are skipped.
 */

type Task = () => Promise<void>;

export class SyncQueue {
  private tail: Promise<void> = Promise.resolve();
  private stopped = false;

  /**
   * Add a task to the end of the queue. Processing starts automatically.
   */
  enqueue(task: Task): void {
    if (this.stopped) {
      return;
    }
    this.tail = this.tail.then(() => {
      if (this.stopped) {
        return;
      }
      return task().catch(err => {
        console.warn('[sync-queue] Task error:', err);
      });
    });
  }

  /**
   * Returns a promise that resolves once all currently-enqueued tasks (including
   * any tasks they enqueue during execution) have completed.
   *
   * If the queue is idle, resolves immediately.
   */
  async waitUntilDone(): Promise<void> {
    let snapshot: Promise<void>;
    do {
      snapshot = this.tail;
      await snapshot;
    } while (snapshot !== this.tail);
  }

  /**
   * Stop the queue. Pending tasks are skipped and future `enqueue()` calls are
   * no-ops.
   */
  stop(): void {
    this.stopped = true;
  }
}
