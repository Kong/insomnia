import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Cloud Sync "Branches" modal and the "Resolve conflicts" modal a merge
 * can open. Opened via `CloudSyncPage.openBranchesDialog()`.
 */
export class CloudSyncBranchesDialogPage extends BasePage {
  private readonly branchesDialog = this.page.getByRole("dialog", {
    name: "Branches",
  });

  /**
   * Waits for the Branches modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.branchesDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }











}
