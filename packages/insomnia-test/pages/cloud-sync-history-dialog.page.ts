import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Cloud Sync "History" modal (snapshot restore). Opened via
 * `CloudSyncPage.openHistory()`.
 */
export class CloudSyncHistoryDialogPage extends BasePage {
  // A getter, not a field: `AppFlow.restart()` swaps `this.page` on the
  // retained page object, so the locator must follow the current window.
  private get historyModal(): ModalComponent {
    return ModalComponent.byTitle(this.page, "History");
  }

  /**
   * Waits for the History modal to be visible.
   */
  async navigate(): Promise<void> {
    await this.historyModal.waitForVisible();
  }

  /**
   * Restores the snapshot whose row displays `message` (its commit
   * message) in the open History modal, via its 2-click confirm. Requires
   * `openHistory()` to have been called first.
   */
  async restoreSnapshot(message: string): Promise<void> {
    await new TableComponent(this.page, this.historyModal.root)
      .row(message)
      .getByRole("button", { name: "Restore" })
      .dblclick();
  }

  /**
   * Closes the History modal.
   */
  async closeHistory(): Promise<void> {
    await this.historyModal.close();
  }
}
