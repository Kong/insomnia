import { expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";

export class GitSyncPage extends BasePage {
  private readonly syncDropdownButton = this.page.getByTestId("git-dropdown");
  private readonly syncMenu = this.page.getByRole("menu", {
    name: "Git Sync",
  });
  private readonly commitDialog = this.page.getByRole("dialog", {
    name: "Commit Changes",
  });
  private readonly branchesDialog = this.page.getByRole("dialog", {
    name: "Branches",
  });
  private readonly historyDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "History" }) });

  /**
   * Waits for a Git Sync surface to become visible: the inline
   * credential-setup card (no credential configured yet), or (once a
   * project is already Git-synced) the Git Sync dropdown. The "Clone from
   * Remote" form itself is modeled on `ProjectSettingsPage`, since it
   * renders inside the same "Create or update dialog" used for project
   * creation/settings, not this class's Git Sync toolbar/modals.
   */
  async navigate(): Promise<void> {
    await this.page
      .getByText("Setup Git Credentials")
      .or(this.syncDropdownButton)
      .waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the branch name (or "Not synced") currently shown on the Git
   * Sync dropdown trigger.
   * @returns The current branch label
   */
  async getCurrentBranch(): Promise<string> {
    return (await this.syncDropdownButton.innerText()).trim();
  }

  /**
   * Checks out `branch` directly from the Git Sync dropdown's branch list
   * (a faster path than opening the Branches modal).
   * @param branch - The branch to check out
   */
  async switchBranch(branch: string): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: branch, exact: true })
      .click();
  }

  /**
   * Opens the Commit modal via the Git Sync dropdown's "Commit" action and
   * waits for its initial git-status fetch to settle (`data-loading`
   * clears). Interacting with the modal while it's still loading is
   * unreliable — a background re-render at the wrong moment can silently
   * wipe a just-filled Message field or leave "Stage all changes" acting
   * on an empty list.
   */
  async openCommitDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Commit", exact: true })
      .click();
    await expect(this.commitDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.commitDialog).not.toHaveAttribute(
      "data-loading",
      "true",
      {
        timeout: DEFAULT_TIMEOUT,
      },
    );
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
    await this.commitDialog
      .getByRole("grid", { name: "Unstaged changes" })
      .getByRole("row")
      .first()
      .waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    await this.commitDialog.locator('button[name="Stage all changes"]').click();
    await expect(
      this.commitDialog.getByRole("heading", { name: /^Staged changes [1-9]/ }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Stages all changes, fills the commit message, and commits (without
   * pushing). Requires `openCommitDialog()` to have been called first.
   * @param message - The commit message
   */
  async commit(message: string): Promise<void> {
    await this.stageAllChanges();
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .click();
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Stages all changes, fills the commit message, and commits + pushes in
   * one action, waiting for the "Changes committed and pushed" toast
   * before returning (it's transient and can't be reliably checked later
   * by a caller doing further UI work in between — and it's a different
   * message than the standalone `push()` action's "Push completed").
   * Requires `openCommitDialog()` to have been called first.
   * @param message - The commit message
   */
  async commitAndPush(message: string): Promise<void> {
    await this.stageAllChanges();
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message);
    await this.commitDialog
      .getByRole("button", { name: "Commit and push" })
      .click();
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(
      this.page.getByText("Changes committed and pushed"),
    ).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Discards every uncommitted change via the Commit modal's "Discard all
   * changes" button, confirming the prompt. Requires `openCommitDialog()`
   * to have been called first. The modal auto-closes once everything has
   * been discarded.
   */
  async discardAllChanges(): Promise<void> {
    await this.commitDialog
      .getByRole("grid", { name: "Unstaged changes" })
      .getByRole("row")
      .first()
      .waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    await this.commitDialog
      .locator('button[name="Discard all changes"]')
      .click();
    await this.page.getByTestId("discard-changes-confirm-button").click();
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the History modal via the Git Sync dropdown's "History" action
   * and waits for its commit log to finish loading.
   */
  async openHistory(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu.getByText("History", { exact: true }).click();
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.historyDialog
      .getByText("Loading...")
      .waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the id (git OID, exposed via the row's `data-key` attribute) and
   * message of the most recent commit from the open History modal — the
   * log lists commits newest-first, and the first row after the column
   * header is that newest commit. Requires `openHistory()` to have been
   * called first.
   * @returns The latest commit's id and message, or undefined if the log is empty
   */
  async getLatestCommit(): Promise<
    { id: string; message: string } | undefined
  > {
    const row = this.historyDialog.getByRole("row").nth(1);
    if (!(await row.isVisible())) return undefined;
    const id = await row.getAttribute("data-key");
    if (!id) return undefined;
    const message = await row.getByRole("rowheader").innerText();
    return { id, message };
  }

  /**
   * Closes the History modal via Escape.
   */
  async closeHistory(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.historyDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the Branches modal via the Git Sync dropdown's "Branches" action.
   */
  async openBranchesDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Branches", exact: true })
      .click();
    await expect(this.branchesDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Creates a new local branch from the Branches modal's "New branch name"
   * field and waits for it to become the active branch (the Create button
   * stays disabled while the request is in flight, so this can't just
   * wait for the click to resolve). Requires `openBranchesDialog()` to
   * have been called first.
   * @param branch - The new branch's name
   */
  async createBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByRole("textbox", { name: "New branch name:" })
      .fill(branch);
    await this.branchesDialog
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(this.branchesDialog.getByText(`${branch} *`)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Checks out `branch` from its row in the Branches modal. Requires
   * `openBranchesDialog()` to have been called first.
   * @param branch - The branch to check out
   */
  async checkoutBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByRole("row", { name: branch, exact: true })
      .getByRole("button", { name: "Checkout" })
      .click();
  }

  /**
   * Deletes `branch` from its row in the Branches modal, confirming the
   * prompt. Requires `openBranchesDialog()` to have been called first.
   * @param branch - The branch to delete
   */
  async deleteBranch(branch: string): Promise<void> {
    const row = this.branchesDialog.getByRole("row", {
      name: branch,
      exact: true,
    });
    await row.getByRole("button", { name: "Delete" }).click();
    await row.getByRole("button", { name: "Confirm" }).click();
  }

  /**
   * Merges `branch` into the current branch, confirming the prompt.
   * Requires `openBranchesDialog()` to have been called first.
   * @param branch - The branch to merge in
   */
  async mergeBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Merge" })
      .click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
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

  private async openSyncMenu(): Promise<void> {
    await this.syncDropdownButton.click();
    await expect(this.syncMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
