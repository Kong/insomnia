import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

/**
 * Shared root for the Preferences dialog's pages: the dialog locator that
 * every tab is scoped to. One subclass per tab (or tab area), all of which
 * assume `PreferencesPage.open()` has already shown the dialog.
 */
export abstract class PreferencesTabPage extends BasePage {
  protected readonly dialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Insomnia Preferences" });

  /**
   * Confirms the Preferences dialog is open by waiting for it to become
   * visible.
   */
  async navigate(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
