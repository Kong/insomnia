import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Page } from "@playwright/test";
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

  async waitForSelectedKey(key: string): Promise<void> {
    await expect(
      this.root.locator(`[role="row"][data-key="${key}"][aria-selected="true"]`),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
