import { expect } from "@playwright/test";

import { TooltipComponent } from "../components/tooltip.component";
import { DEFAULT_TIMEOUT } from "../misc/constants";
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
   * Stages `name`, fills the commit message, and commits locally without
   * pushing, then closes the Commit modal. Requires `openCommitDialog()` to
   * have been called first.
   *
   * The modal only closes itself once nothing is left to commit — adding a
   * request also leaves a sibling's own automatic update unstaged — so it is
   * closed explicitly when it stays open after `name`'s row is committed.
   */
  async commit(name: string, message: string): Promise<void> {
    await this.stageChange(name);
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .click();
    await expect(this.commitDialog.getByRole("row", { name })).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT,
    });
    const closedItself = await this.commitDialog
      .waitFor({ state: "hidden", timeout: 3000 })
      .then(
        () => true,
        () => false,
      );
    if (!closedItself) {
      await this.commitDialog.locator('[data-icon="x"]').click();
    }
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
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

  private readonly unknownFieldsConfirmDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "Unrecognized Fields" }) });

  /**
   * Closes the open Commit modal with its close (x) button and waits for
   * it to be hidden.
   */
  async closeCommitDialog(): Promise<void> {
    await this.commitDialog.locator('[data-icon="x"]').click();
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Lists the visible names of every change row (staged and unstaged) in
   * the open Commit modal. Requires `openCommitDialog()` to have been
   * called first.
   */
  async getChangeNames(): Promise<string[]> {
    const rows = this.commitDialog
      .getByRole("row")
      .filter({ has: this.page.locator('[data-icon="plus"], [data-icon="minus"]') });
    await rows.first().waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    const texts = await rows.allInnerTexts();
    return texts.map((text) => text.split("\n")[0].trim());
  }

  /**
   * Clicks a row in the open Commit modal to open its diff, and waits for
   * the diff pane's heading to show it. Requires `openCommitDialog()` to
   * have been called first.
   */
  async openChangeDiff(name: string): Promise<void> {
    await this.commitDialog.getByRole("row", { name }).click();
    await expect(
      this.commitDialog.getByRole("heading", { name, exact: true }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads whether the open Commit modal's diff pane shows the unknown
   * fields banner. Requires `openChangeDiff()` to have been called.
   */
  async isUnknownFieldsDiffWarningVisible(): Promise<boolean> {
    return this.commitDialog.getByTestId("unknown-fields-diff-warning").isVisible();
  }

  /**
   * Counts the diff editor's highlighted unknown-field lines in the open
   * Commit modal. Requires `openChangeDiff()` to have been called.
   */
  async getUnknownFieldHighlightCount(): Promise<number> {
    return this.commitDialog.locator(".unknown-field-line-bg").count();
  }

  /**
   * Reads the red "unsupported" banner's text from the open Commit modal's
   * diff pane. Requires `openChangeDiff()` to have been called.
   */
  async getUnsupportedDocDiffErrorText(): Promise<string> {
    const banner = this.commitDialog.getByTestId("unsupported-doc-diff-error");
    return (await banner.isVisible()) ? (await banner.innerText()).trim() : "";
  }

  /**
   * Hovers a row's unknown fields warning icon and reads its tooltip.
   */
  async getUnknownFieldsIconTooltip(name: string): Promise<string> {
    return this.readRowIconTooltip(name, "Unrecognized fields warning");
  }

  /**
   * Hovers a row's "unsupported item" error icon and reads its tooltip.
   */
  async getUnsupportedItemIconTooltip(name: string): Promise<string> {
    return this.readRowIconTooltip(name, "Unsupported item error");
  }

  private async readRowIconTooltip(name: string, iconLabel: string): Promise<string> {
    const icon = this.commitDialog.getByRole("row", { name }).getByLabel(iconLabel);
    return new TooltipComponent(this.page, icon).read();
  }

  /**
   * Stages `name`, fills the commit message and clicks "Commit", without
   * waiting for the commit to finish — for a commit that opens the
   * "Unrecognized Fields" confirmation. Requires `openCommitDialog()` to
   * have been called first.
   */
  async submitCommit(name: string, message: string): Promise<void> {
    await this.stageChange(name);
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.clickCommit();
  }

  /**
   * Clicks "Commit" in the open Commit modal on whatever is staged, with
   * whatever message is already filled in.
   */
  async clickCommit(): Promise<void> {
    await this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .click();
  }

  /**
   * Reads whether `name` is listed as a staged change (its row shows the
   * unstage "minus" button) in the open Commit modal.
   */
  async isChangeStaged(name: string): Promise<boolean> {
    return this.commitDialog
      .getByRole("row", { name })
      .locator('[data-icon="minus"]')
      .isVisible();
  }

  /**
   * Reads whether the "Unrecognized Fields" confirmation is open.
   */
  async isUnknownFieldsConfirmationVisible(): Promise<boolean> {
    return this.unknownFieldsConfirmDialog.isVisible();
  }

  /**
   * Waits for the "Unrecognized Fields" confirmation and reads its text.
   */
  async getUnknownFieldsConfirmationText(): Promise<string> {
    await expect(this.unknownFieldsConfirmDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await this.unknownFieldsConfirmDialog.innerText()).trim();
  }

  /**
   * Cancels the open "Unrecognized Fields" confirmation, leaving the
   * commit not created.
   */
  async cancelUnknownFieldsConfirmation(): Promise<void> {
    await this.unknownFieldsConfirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.unknownFieldsConfirmDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Continues past the open "Unrecognized Fields" confirmation, creating
   * the commit, and waits for `name` to leave the Commit modal's lists.
   */
  async confirmUnknownFieldsCommit(name: string): Promise<void> {
    await this.page.getByTestId("unknown-fields-commit-confirm-button").click();
    await expect(this.unknownFieldsConfirmDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(this.commitDialog.getByRole("row", { name })).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
