import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, POLL_INTERVAL } from "./constants";

/**
 * Waits for the page's own event loop to drain everything already queued
 * in it — every pending microtask (promise `.then()` chains), then one
 * full macrotask turn — before returning. Use right before an action whose
 * outcome depends on a React state update that a just-confirmed async write
 * triggers a moment *later* rather than synchronously, such as a React
 * Router loader revalidation. Because this round-trips through the
 * renderer's own task queue instead of guessing a duration from the test
 * process (`page.waitForTimeout()`), anything already scheduled inside the
 * page — including a slow revalidation stalled behind a busy main thread
 * under CI load — is guaranteed to have run by the time this resolves.
 */
export async function waitForRendererIdle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => setTimeout(resolve, 0), 0);
      }),
  );
}

/**
 * Polls `read` until it returns the same value (compared by JSON) on
 * `stableReads` consecutive reads — the poll-based replacement for
 * sleeping while a debounced/async re-render (a filtered list, a search
 * result set, a tree after a drop) settles.
 */
export async function waitForStableValue<T>(
  read: () => Promise<T>,
  stableReads = 3,
  timeout = DEFAULT_TIMEOUT,
): Promise<T> {
  let previous = "";
  let streak = 0;
  let value!: T;
  await expect(async () => {
    value = await read();
    const serialized = JSON.stringify(value);
    streak = serialized === previous ? streak + 1 : 1;
    previous = serialized;
    expect(streak).toBeGreaterThanOrEqual(stableReads);
  }).toPass({ timeout, intervals: [POLL_INTERVAL] });
  return value;
}
