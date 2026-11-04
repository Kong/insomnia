import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Cloud Sync "Commit changes" modal: staging, committing, the per-change
 * diff, and the "Unrecognized Fields" confirmation. Opened via
 * `CloudSyncPage.openCommitDialog()`.
 */
export class CloudSyncCommitDialogPage extends BasePage {
  private readonly commitDialog = this.page.getByRole("dialog", {
    name: "Commit changes",
  });

  /**
   * Waits for the Commit modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.commitDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
