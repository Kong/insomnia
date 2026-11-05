import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * Shared root for the Preferences dialog's components: the dialog locator
 * that every tab is scoped to. One subclass per tab (or tab area), all of
 * which assume `PreferencesComponent.open()` has already shown the dialog.
 * The dialog is global — it can be opened from any page — so it lives in
 * the component layer rather than being tied to one page.
 */
export abstract class PreferencesTabComponent extends BaseComponent {
  constructor(page: Page) {
    super(
      page,
      page.getByRole("dialog").filter({ hasText: "Insomnia Preferences" }),
    );
  }

  protected get dialog(): Locator {
    return this.root;
  }

  /**
   * Confirms the Preferences dialog is open by waiting for it to become
   * visible.
   */
  async waitUntilOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
