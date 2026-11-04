import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The virtualized project navigation tree
 * (`sidebar/project-navigation-sidebar`, `role="grid"` named
 * "Project Navigation Tree"). Only rows currently in the DOM are visible to
 * it; use `scrollToRow` for rows outside the viewport. Full-tree scraping
 * stays in `WorkspacePage`'s `Tree`.
 */
export class TreeComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole("grid", { name: "Project Navigation Tree" }));
  }

  get scroller(): Locator {
    return this.page.getByTestId("project-navigation-tree-container");
  }

  /**
   * The row for `key` looked up inside the scroll container (the form
   * `WorkspacePage` has always used), rather than inside the grid.
   */
  containerRow(key: string): Locator {
    return this.scroller.locator(`div[role="row"][data-key="${key}"]`);
  }

  async clickByKey(key: string): Promise<void> {
    const row = this.containerRow(key);
    await row.scrollIntoViewIfNeeded();
    await row.click();
  }

  /** Focuses the row (Playwright's `press` does) and sends `shortcut`. */
  async pressOnRow(key: string, shortcut: string): Promise<void> {
    const row = this.containerRow(key);
    await row.scrollIntoViewIfNeeded();
    await row.press(shortcut);
  }

  /** Expanded rows render a "Collapse {name}" toggle. */
  async isExpandedByKey(key: string, name: string): Promise<boolean> {
    return (
      (await this.containerRow(key)
        .getByRole("button", { name: `Collapse ${name}` })
        .count()) > 0
    );
  }

  async waitForExpanded(
    key: string,
    name: string,
    expected: boolean,
  ): Promise<void> {
    await expect(async () => {
      expect(await this.isExpandedByKey(key, name)).toBe(expected);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /** Right-arrow expands, then waits for the async toggle to settle. */
  async expandByKey(key: string, name: string): Promise<void> {
    await this.pressOnRow(key, "ArrowRight");
    await this.waitForExpanded(key, name, true);
  }
}
