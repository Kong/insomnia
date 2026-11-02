import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";

/**
 * Root of the component layer (flow → page → component). A component wraps
 * one reusable piece of Insomnia UI (a modal, a dropdown, a code editor…)
 * and is scoped to a single `root` locator, so the same class can be
 * instantiated once per occurrence on a page.
 *
 * Components only know how to drive their own widget; which widget to use
 * and where it lives is the owning page's concern.
 */
export abstract class BaseComponent {
  constructor(
    protected readonly page: Page,
    readonly root: Locator,
  ) {}

  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }

  async waitForVisible(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await expect(this.root).toBeVisible({ timeout });
  }

  async waitForHidden(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await expect(this.root).toBeHidden({ timeout });
  }

  /**
   * Waits for the renderer's own event loop to drain everything already
   * queued (microtasks, then one macrotask turn). See `BasePage` for the
   * rationale; duplicated here so components don't depend on a page.
   */
  protected async waitForRendererIdle(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => setTimeout(resolve, 0), 0);
        }),
    );
  }

  /**
   * Polls `read` until it returns the same value (compared by JSON) on
   * `stableReads` consecutive reads.
   */
  protected async waitForStableValue<T>(
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
    }).toPass({ timeout, intervals: [100] });
    return value;
  }
}
