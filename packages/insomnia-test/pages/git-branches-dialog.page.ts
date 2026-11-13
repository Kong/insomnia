import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Git "Branches" modal (create / checkout / delete / merge) and the
 * "Resolve conflicts" modal a merge can open. Opened from the Git Sync
 * dropdown via `GitSyncPage.openBranchesDialog()`.
 */
export class GitBranchesDialogPage extends BasePage {
  private readonly branchesModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Branches" }),
  );
  private readonly mergeConflictsModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Resolve conflicts" }),
  );

  /**
   * Waits for the Branches modal to be visible.
   */
  async navigate(): Promise<void> {
    await this.branchesModal.waitForVisible();
  }

  /**
   * Creates a new local branch from the Branches modal's "New branch name"
   * field and waits for it to become the active branch (the Create button
   * stays disabled while the request is in flight, so this can't just
   * wait for the click to resolve). Requires `openBranchesDialog()` to
   * have been called first.
   */
  async createBranch(branch: string): Promise<void> {
    await this.branchesModal.root
      .getByRole("textbox", { name: "New branch name:" })
      .fill(branch);
    await this.branchesModal.root
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(this.branchesModal.root.getByText(`${branch} *`)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Checks out `branch` from its row in the Branches modal. Requires
   * `openBranchesDialog()` to have been called first.
   */
  async checkoutBranch(branch: string): Promise<void> {
    await this.branchesModal.root
      .getByRole("row", { name: branch, exact: true })
      .getByRole("button", { name: "Checkout" })
      .click();
  }

  /**
   * Deletes `branch` from its row in the Branches modal, confirming the
   * prompt. Requires `openBranchesDialog()` to have been called first.
   */
  async deleteBranch(branch: string): Promise<void> {
    const row = this.branchesModal.root.getByRole("row", {
      name: branch,
      exact: true,
    });
    await row.getByRole("button", { name: "Delete" }).click();
    await row.getByRole("button", { name: "Confirm" }).click();
  }

  /**
   * Merges `branch` into the current branch, confirming the prompt.
   * Requires `openBranchesDialog()` to have been called first.
   */
  async mergeBranch(branch: string): Promise<void> {
    await this.branchesModal.root
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Merge" })
      .click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  /**
   * Submits `branch` in the Branches modal's "New branch name" field
   * without waiting for it to become the active branch — for names the app
   * is expected to reject. Requires `openBranchesDialog()` to have been
   * called first.
   */
  async submitNewBranch(branch: string): Promise<void> {
    await this.branchesModal.root
      .getByRole("textbox", { name: "New branch name:" })
      .fill(branch);
    await this.branchesModal.root
      .getByRole("button", { name: "Create", exact: true })
      .click();
  }

  /**
   * Reads the validation error shown under the Branches modal's "New
   * branch name" field after a rejected `submitNewBranch()`. Waits for it
   * to appear. Requires `openBranchesDialog()` to have been called first.
   */
  async getNewBranchError(): Promise<string> {
    const error = this.branchesModal.root.getByTestId("git-branch-create-error");
    await expect(error).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await error.innerText()).trim();
  }

  /**
   * Reads the names listed under "Local Branches" (without the current
   * branch's trailing " *"). Requires `openBranchesDialog()` to have been
   * called first.
   */
  async getLocalBranches(): Promise<string[]> {
    return this.readBranchRows("Branches list");
  }

  /**
   * Reads the names listed under "Remote Branches" (remote-only branches).
   * Waits for the "Fetching remote branches..." placeholder to clear.
   * Requires `openBranchesDialog()` to have been called first.
   */
  async getRemoteBranches(): Promise<string[]> {
    await expect(
      this.branchesModal.root.getByText("Fetching remote branches..."),
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return this.readBranchRows("Remote Branches list");
  }

  /**
   * Checks out a remote-only branch via its "Fetch and checkout" button and
   * waits for it to become the active branch. Requires
   * `openBranchesDialog()` to have been called first.
   */
  async checkoutRemoteBranch(branch: string): Promise<void> {
    await new TableComponent(
      this.page,
      this.branchesModal.root.getByRole("grid", {
        name: "Remote Branches list",
        exact: true,
      }),
    )
      .rows.filter({ hasText: branch })
      .getByRole("button", { name: "Fetch and checkout" })
      .click();
    await expect(this.branchesModal.root.getByText(`${branch} *`)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Resolves every conflicted file listed in the "Resolve conflicts" modal
   * by taking the same side for each (via "Take all current/incoming
   * changes" in the merge editor, confirming the prompt), then submits and waits for the modal to
   * close. Call after `mergeBranch()` or `pull()` hit conflicts.
   */
  async resolveMergeConflicts(version: "Current" | "Incoming"): Promise<void> {
    await this.mergeConflictsModal.waitForVisible();
    const rows = new TableComponent(
      this.page,
      this.mergeConflictsModal.root.getByRole("grid", { name: "Conflicted changes" }),
    ).rows;
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await rows.nth(i).click();
      await this.mergeConflictsModal.root
        .getByRole("button", {
          name: `Take all ${version.toLowerCase()} changes`,
        })
        .click();
      await this.page.getByRole("button", { name: "Confirm" }).click();
    }
    await this.mergeConflictsModal.root
      .getByRole("button", { name: "Resolve conflicts" })
      .click();
    await this.mergeConflictsModal.waitForHidden();
  }

  /**
   * Closes the Branches modal.
   */
  async closeBranchesDialog(): Promise<void> {
    await this.page.getByTestId("close-git-project-branches-modal").click();
    await this.page
      .getByTestId("git-project-branches-modal-overlay")
      .waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  private async readBranchRows(
    list: "Branches list" | "Remote Branches list",
  ): Promise<string[]> {
    const rows = this.branchesModal.root
      .getByRole("grid", { name: list, exact: true })
      .locator('[role="row"][data-key]');
    const texts = await rows.allInnerTexts();
    return texts.map((text) => text.split("\n")[0].replace(/\s*\*$/, "").trim());
  }
}
