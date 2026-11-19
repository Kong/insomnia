import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Git "Commit Changes" modal: staging, committing, discarding, and the
 * per-file diff pane (Text / Visual views). Opened from the Git Sync
 * dropdown via `GitSyncPage.openCommitDialog()`.
 */
export class GitCommitDialogPage extends BasePage {
  private readonly commitModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Commit Changes" }),
  );

  /**
   * Waits for the Commit modal to be visible.
   */
  async navigate(): Promise<void> {
    await this.commitModal.waitForVisible();
  }

  /**
   * Stages every unstaged change in the open Commit modal. The changes
   * list loads asynchronously after the modal opens, so this waits for at
   * least one unstaged row to appear before staging — otherwise "Stage all
   * changes" can fire while the list is still empty and stage nothing.
   * The staged/unstaged counts are themselves eventually consistent (the
   * click resolves before the UI polls the new git status), so this also
   * waits for the "Staged changes" count to become nonzero before
   * returning. Requires `openCommitDialog()` to have been called first.
   */
  private async stageAllChanges(): Promise<void> {
    await new TableComponent(
      this.page,
      this.commitModal.root.getByRole("grid", { name: "Unstaged changes" }),
    )
      .rows.first()
      .waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    await this.commitModal.root.locator('button[name="Stage all changes"]').click();
    await expect(
      this.commitModal.root.getByRole("heading", { name: /^Staged changes [1-9]/ }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Stages all changes, fills the commit message, and commits (without
   * pushing). Requires `openCommitDialog()` to have been called first.
   */
  async commit(message: string): Promise<void> {
    await this.stageAllChanges();
    await this.commitModal.root
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitModal.root
      .getByRole("button", { name: "Commit", exact: true })
      .click();
    await this.commitModal.waitForHidden();
  }

  /**
   * Stages all changes, fills the commit message, and commits + pushes in
   * one action, waiting for the "Changes committed and pushed" toast
   * before returning (it's transient and can't be reliably checked later
   * by a caller doing further UI work in between — and it's a different
   * message than the standalone `push()` action's "Push completed").
   * Requires `openCommitDialog()` to have been called first.
   */
  async commitAndPush(message: string): Promise<void> {
    await this.stageAllChanges();
    await this.commitModal.root
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitModal.root
      .getByRole("button", { name: "Commit and push" })
      .click();
    await this.commitModal.waitForHidden();
    await expect(
      this.page.getByText("Changes committed and pushed"),
    ).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
