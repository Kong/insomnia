import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * Workspace pane header breadcrumbs (`pane-header.tsx`,
 * `workspace/use-workspace-breadcrumb.tsx`), one
 * `data-testid="workspace-breadcrumb-level-<n>"` per crumb.
 */
export class BreadcrumbComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByTestId("workspace-breadcrumbs"));
  }

  level(index: number): Locator {
    return this.page.getByTestId(`workspace-breadcrumb-level-${index}`);
  }

  async labels(): Promise<string[]> {
    return (
      await this.page.locator('[data-testid^="workspace-breadcrumb-level-"]').allInnerTexts()
    ).map((t) => t.trim());
  }

  /** Clicks a non-last crumb (a link) by its label. */
  async navigateTo(label: string): Promise<void> {
    await this.page
      .locator('[data-testid^="workspace-breadcrumb-level-"]')
      .getByRole("link", { name: label, exact: true })
      .click();
  }

  /** Waits until the crumb labels stop changing (route transitions). */
  async waitForSettled(): Promise<string[]> {
    return this.waitForStableValue(() => this.labels());
  }

  async expectLast(label: string): Promise<void> {
    const crumbs = this.page.locator('[data-testid^="workspace-breadcrumb-level-"]');
    await expect(crumbs.last()).toHaveText(label, { timeout: DEFAULT_TIMEOUT });
  }
}
