import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Git "Commit Changes" modal: staging, committing, discarding, and the
 * per-file diff pane (Text / Visual views). Opened from the Git Sync
 * dropdown via `GitSyncPage.openCommitDialog()`.
 */
export class GitCommitDialogPage extends BasePage {
  private readonly commitDialog = this.page.getByRole("dialog", {
    name: "Commit Changes",
  });


  /**
   * Waits for the Commit modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.commitDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }









































































}
