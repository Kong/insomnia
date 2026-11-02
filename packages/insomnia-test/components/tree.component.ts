import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
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

  get rows(): Locator {
    return this.root.locator('div[role="row"][data-key]');
  }

  /** Row by accessible name (the node's name). */
  row(name: string | RegExp): Locator {
    return this.root.getByRole("row", { name });
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

  async collapseByKey(key: string, name: string): Promise<void> {
    await this.pressOnRow(key, "ArrowLeft");
    await this.waitForExpanded(key, name, false);
  }

  /** Waits for `aria-selected="true"` to hold across two consecutive reads. */
  async waitForSelectedByKey(key: string): Promise<void> {
    const row = this.containerRow(key);
    let previous: string | null = null;
    await expect(async () => {
      const current = await row.getAttribute("aria-selected");
      expect(current === "true").toBe(true);
      const stable = current === previous;
      previous = current;
      expect(stable).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  rowByKey(key: string): Locator {
    return this.root.locator(`div[role="row"][data-key="${key}"]`);
  }

  async visibleRowNames(): Promise<string[]> {
    return this.rows.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label") ?? ""),
    );
  }

  /** Scrolls the virtualized list down until `name` renders, then returns it. */
  async scrollToRow(name: string | RegExp): Promise<Locator> {
    const target = this.row(name);
    await expect(async () => {
      if ((await target.count()) === 0) {
        await this.scroller.evaluate((el) => el.scrollBy(0, el.clientHeight));
      }
      await expect(target.first()).toBeAttached({ timeout: 1000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return target.first();
  }

  async select(name: string | RegExp): Promise<void> {
    await (await this.scrollToRow(name)).click();
  }

  async expand(name: string | RegExp): Promise<void> {
    const row = await this.scrollToRow(name);
    const toggle = row.getByRole("button", { name: /^Expand / });
    if (await toggle.isVisible()) await toggle.click();
  }

  async collapse(name: string | RegExp): Promise<void> {
    const row = await this.scrollToRow(name);
    const toggle = row.getByRole("button", { name: /^Collapse / });
    if (await toggle.isVisible()) await toggle.click();
  }

  async isSelected(name: string | RegExp): Promise<boolean> {
    return (await this.row(name).first().getAttribute("aria-selected")) === "true";
  }

  async hasRow(name: string | RegExp): Promise<boolean> {
    return (await this.row(name).count()) > 0;
  }
}
