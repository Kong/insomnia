import { waitForRendererIdle } from "@package/misc/wait";
import type { Locator, Page } from "@playwright/test";

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

  protected async waitForRendererIdle(): Promise<void> {
    await waitForRendererIdle(this.page);
  }
}
