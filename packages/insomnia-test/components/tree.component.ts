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
