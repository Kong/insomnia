import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

/**
 * The Cloud Sync "Branches" modal and the "Resolve conflicts" modal a merge
 * can open. Opened via `CloudSyncPage.openBranchesDialog()`.
 */
export class CloudSyncBranchesDialogPage extends BasePage {
  private readonly branchesDialog = this.page.getByRole("dialog", {
    name: "Branches",
  });
  private readonly mergeConflictsDialog = this.page.getByRole("dialog", {
    name: "Resolve conflicts",
  });

  /**
   * Waits for the Branches modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.branchesDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fetches a remote-only branch into the local branches list, from its
   * row in the Branches modal's "Remote Branches list". Requires
   * `openBranchesDialog()` to have been called first.
   */
  async fetchRemoteBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByLabel("Remote Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Fetch" })
      .click();
  }

  /**
   * Checks out `branch` from its row in the Branches modal's local
   * "Branches list". Requires `openBranchesDialog()` to have been called
   * first.
   */
  async checkoutLocalBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Checkout" })
      .click();
  }

  /**
   * Deletes local branch `branch` via its row in the Branches modal's
   * local "Branches list", confirming the 2-click prompt. Requires
   * `openBranchesDialog()` to have been called first.
   */
  async deleteLocalBranch(branch: string): Promise<void> {
    const row = this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true });
    await row.getByRole("button", { name: "Delete" }).click();
    // A dblclick can fire its 2nd click before React re-renders the
    // button into its "Confirm" state, so wait for it explicitly.
    await row.getByRole("button", { name: "Confirm" }).click();
  }

  /**
   * Whether local branch `branch`'s "Delete" button is currently
   * disabled (e.g. because it's the currently checked-out branch).
   * Requires `openBranchesDialog()` to have been called first.
   */
  async isLocalBranchDeleteDisabled(branch: string): Promise<boolean> {
    return this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Delete" })
      .isDisabled();
  }

  /**
   * Merges local branch `branch` into whichever branch is currently
   * checked out, via its row in the Branches modal's local "Branches
   * list", confirming the 2-click prompt. Requires `openBranchesDialog()`
   * to have been called first.
   */
  async mergeBranch(branch: string): Promise<void> {
    const row = this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true });
    await row.getByRole("button", { name: "Merge" }).click();
    // A dblclick can fire its 2nd click before React re-renders the
    // button into its "Confirm" state, so wait for it explicitly.
    await row.getByRole("button", { name: "Confirm" }).click();
  }

  /**
   * Whether `branch` is currently listed in the Branches modal's local
   * "Branches list". Requires `openBranchesDialog()` to have been called
   * first.
   */
  async isLocalBranchListed(branch: string): Promise<boolean> {
    const list = this.branchesDialog.getByLabel("Branches list", {
      exact: true,
    });
    await expect(list).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // `isVisible()` doesn't auto-wait, and the list can still be rendering
    // right after the modal opens — wait briefly for the row to appear
    // before concluding it isn't listed.
    return list
      .getByLabel(branch, { exact: true })
      .waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT })
      .then(
        () => true,
        () => false,
      );
  }

  /**
   * Waits for `branch` to disappear from the Branches modal's local
   * "Branches list" (e.g. after deleting it). Unlike
   * `isLocalBranchListed()`, which blocks up to the timeout while a row is
   * absent, this returns as soon as the row is gone. Requires
   * `openBranchesDialog()` to have been called first.
   */
  async waitForLocalBranchRemoved(branch: string): Promise<void> {
    await expect(
      this.branchesDialog
        .getByLabel("Branches list", { exact: true })
        .getByLabel(branch, { exact: true }),
    ).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Creates a new local branch from the Branches modal's "New branch
   * name" field. Requires `openBranchesDialog()` to have been called
   * first.
   */
  async createBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByRole("textbox", { name: "Branch name" })
      .fill(branch);
    await this.branchesDialog
      .getByRole("button", { name: "Create", exact: true })
      .click();
  }

  /**
   * Waits for the inline error under the Branches modal's "Branch name"
   * field to read exactly `message` — shown when creating a branch fails
   * (an invalid or already-used name). Requires `openBranchesDialog()` to
   * have been called first.
   */
  async waitForBranchCreationError(message: string): Promise<void> {
    await expect(
      this.branchesDialog.getByText(message, { exact: true }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Resolves every conflicted file listed in the "Resolve conflicts" modal
   * by choosing the same side for each, then submits and waits for the
   * modal to close. Call after `mergeBranch()` hit conflicts.
   */
  async resolveMergeConflicts(
    version: "Current" | "Incoming",
  ): Promise<string[]> {
    await expect(this.mergeConflictsDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    const rows = this.mergeConflictsDialog
      .getByRole("grid", { name: "Conflicted changes" })
      .getByRole("row");
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(
        (await rows.nth(i).getByTestId("merge-conflict-name").innerText()).trim(),
      );
      await rows
        .nth(i)
        .getByTestId(`merge-conflict-choice-${version.toLowerCase()}`)
        .click();
    }
    await this.mergeConflictsDialog
      .getByRole("button", { name: "Resolve conflicts" })
      .click();
    await expect(this.mergeConflictsDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
    return names;
  }

  /**
   * Closes the Branches modal.
   */
  async closeBranchesDialog(): Promise<void> {
    await this.branchesDialog.locator('[data-icon="x"]').click();
    await expect(this.branchesDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }
}
