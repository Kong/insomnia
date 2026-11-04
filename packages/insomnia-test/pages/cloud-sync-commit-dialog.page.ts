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

  /**
   * Stages one unstaged change by its row name (e.g. a request's name) in
   * the open Commit modal. Requires `openCommitDialog()` to have been
   * called first.
   */
  private async stageChange(name: string): Promise<void> {
    const row = this.commitDialog.getByRole("row", { name });
    await row.locator('[data-icon="plus"]').click();
    // Staging is an async action: committing before the row has moved to
    // the staged list (its button turns into a "minus") commits nothing.
    await expect(row.locator('[data-icon="minus"]')).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }


  /**
   * Stages `name`, fills the commit message, and commits + pushes in one
   * action. Requires `openCommitDialog()` to have been called first.
   */
  async commitAndPush(name: string, message: string): Promise<void> {
    await this.stageChange(name);
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitDialog
      .getByRole("button", { name: "Commit and push" })
      .click();
  }

















}
