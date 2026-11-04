import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Cloud Sync "History" modal (snapshot restore). Opened via
 * `CloudSyncPage.openHistory()`.
 */
export class CloudSyncHistoryDialogPage extends BasePage {
  // A getter, not a field: `AppFlow.restart()` swaps `this.page` on the
  // retained page object, so the locator must follow the current window.
  private get historyDialog(): Locator {
    return this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("heading", { name: "History" }) });
  }

  /**
   * Waits for the History modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }


}
