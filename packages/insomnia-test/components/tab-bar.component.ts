import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The app-level tab bar (`tabs/tab-list.tsx`, `aria-label="Insomnia Tabs"`):
 * one `role="row"` per open request/collection tab, plus the "+" button.
 * Distinct from `TabsComponent`, which wraps react-aria `role="tab"` strips.
 * A row's `data-key` is the opened item's `_id`.
 */
export class TabBarComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.locator('[aria-label="Insomnia Tabs"]'));
  }

  get rows(): Locator {
    return this.root.locator('[role="row"]');
  }

  /** The tab whose row text contains `name`. */
  tab(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  tabByKey(key: string): Locator {
    return this.root.locator(`[role="row"][data-key="${key}"]`);
  }

  get addButton(): Locator {
    return this.page.locator('[aria-label="Tab Plus"]');
  }

  /** A row's title, skipping the method tag. */
  async nameOf(row: Locator): Promise<string> {
    return (await row.getByTestId("tab-title").innerText()).trim();
  }

  /** Names of all open tabs, left to right. */
  async names(): Promise<string[]> {
    const count = await this.rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(await this.nameOf(this.rows.nth(i)));
    }
    return names;
  }

  async activeName(): Promise<string | undefined> {
    const active = this.root.locator('[role="row"][aria-selected="true"]');
    if ((await active.count()) === 0) return undefined;
    return this.nameOf(active.first());
  }

  async isOpen(name: string): Promise<boolean> {
    return (await this.tab(name).count()) > 0;
  }

  /** Clicks the tab and waits until it is selected and the route settled. */
  async activate(name: string): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveAttribute("aria-selected", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
    await this.waitForRendererIdle();
  }

  async close(name: string): Promise<void> {
    await this.tab(name).locator('[data-testid="tab-close-button"]').click();
  }

  async methodTag(name: string): Promise<string> {
    return (
      await this.tab(name).locator('[aria-label="Tab Tag"]').innerText()
    ).trim();
  }

  /** Double-click pins a temporary (italic preview) tab. */
  async pin(name: string): Promise<void> {
    await this.tab(name).dblclick();
  }

  async openAddMenu(): Promise<void> {
    await this.addButton.click();
  }

  async waitForSelectedKey(key: string): Promise<void> {
    await expect(
      this.root.locator(`[role="row"][data-key="${key}"][aria-selected="true"]`),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
