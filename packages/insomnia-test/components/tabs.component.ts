import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Tabs` widget (`basic-components/tabs.tsx`, request/response
 * pane tabs). `root` is the container that holds both the tab list and the
 * `tabpanel`s, e.g. a request pane.
 */
export class TabsComponent extends BaseComponent {
  /** A tab by its `data-key`. */
  tab(key: string): Locator {
    return this.root.locator(`[data-key="${key}"][role="tab"]`);
  }

  /** A tab by its visible label. */
  tabByName(name: string | RegExp): Locator {
    return this.root.getByRole("tab", { name });
  }

  get panel(): Locator {
    return this.root.locator('[role="tabpanel"]');
  }

  async switchTo(key: string): Promise<void> {
    await this.tab(key).click();
    await expect(this.tab(key)).toHaveAttribute("aria-selected", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async switchToByName(name: string | RegExp): Promise<void> {
    await this.tabByName(name).click();
    await expect(this.tabByName(name)).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: DEFAULT_TIMEOUT },
    );
  }

  async selectedKey(): Promise<string | null> {
    const selected = this.root
      .locator('[role="tab"][aria-selected="true"]')
      .first();
    return (await selected.count()) === 0
      ? null
      : selected.evaluate((el) => (el as HTMLElement).dataset.key ?? null);
  }

  async tabNames(): Promise<string[]> {
    return (await this.root.getByRole("tab").allInnerTexts()).map((t) =>
      t.trim(),
    );
  }

  async hasTab(key: string): Promise<boolean> {
    return (await this.tab(key).count()) > 0;
  }
}
