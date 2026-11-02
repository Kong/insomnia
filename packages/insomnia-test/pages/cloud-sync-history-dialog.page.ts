import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

/**
 * The Cloud Sync "History" modal (snapshot restore). Opened via
 * `CloudSyncPage.openHistory()`.
 */
export class CloudSyncHistoryDialogPage extends BasePage {
  private readonly historyDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "History" }) });

  /**
   * Waits for the History modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Restores the snapshot whose row displays `message` (its commit
   * message) in the open History modal, via its 2-click confirm. Requires
   * `openHistory()` to have been called first.
   */
  async restoreSnapshot(message: string): Promise<void> {
    await this.historyDialog
      .getByRole("row", { name: message })
      .getByRole("button", { name: "Restore" })
      .dblclick();
  }

  /**
   * Closes the History modal.
   */
  async closeHistory(): Promise<void> {
    await this.historyDialog.locator('[data-icon="x"]').click();
    await expect(this.historyDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }
}
