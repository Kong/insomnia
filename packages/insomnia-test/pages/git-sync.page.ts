import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

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
  private readonly mergeConflictsDialog = this.page.getByRole("dialog", {
    name: "Resolve conflicts",
  });
  private readonly historyDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "History" }) });

  private readonly changeRow = (
    list: "Staged changes" | "Unstaged changes",
    fileName: string,
  ) =>
    this.commitDialog
      .getByRole("grid", { name: list, exact: true })
      .locator('[role="row"][data-key]')
      .filter({ hasText: fileName });

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
   * (a faster path than opening the Branches modal), and waits for the
   * dropdown's label to show it as the current branch.
   * @param branch - The branch to check out
   */
  async switchBranch(branch: string): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: branch, exact: true })
      .click();
    await expect(this.syncDropdownButton).toContainText(branch, {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Fetches from the remote via the Git Sync dropdown's "Fetch" action.
   */
  async fetch(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Fetch", exact: true })
      .click();
  }

  /**
   * Pulls from the remote via the Git Sync dropdown's "Pull" action. Does
   * not wait for anything: a clean pull has no toast, and a conflicting
   * one opens the merge modal instead.
   */
  async pull(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Pull", exact: true })
      .click();
  }

  /**
   * Pushes the current branch via the Git Sync dropdown's "Push" action and
   * waits for the "Push completed" toast.
   */
  async push(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Push", exact: true })
      .click();
    await expect(this.page.getByText("Push completed")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Opens the Commit modal via the Git Sync dropdown's "Commit" action
   * (the item stays disabled until the dropdown's git status reflects an
   * uncommitted change, so the menu is reopened to force a refresh until it
   * enables) and waits for its initial git-status fetch to settle (`data-loading`
   * clears). Interacting with the modal while it's still loading is
   * unreliable — a background re-render at the wrong moment can silently
   * wipe a just-filled Message field or leave "Stage all changes" acting
   * on an empty list.
   */
  async openCommitDialog(): Promise<void> {
    await expect(async () => {
      await this.openSyncMenu();
      const commitItem = this.syncMenu.getByRole("menuitemradio", {
        name: "Commit",
        exact: true,
      });
      try {
        await expect(commitItem).toBeEnabled({ timeout: 3000 });
      } catch (error) {
        await this.page.keyboard.press("Escape");
        throw error;
      }
      await commitItem.click();
    }).toPass({ timeout: DEFAULT_TIMEOUT * 3 });
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
   * Closes the Commit modal via Escape. The dialog is focused first: after
   * a commit the focused button becomes disabled and focus falls back to
   * the page body, where Escape no longer reaches the modal.
   */
  async closeCommitDialog(): Promise<void> {
    await this.commitDialog.focus();
    await this.page.keyboard.press("Escape");
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the file names listed under "Staged changes" in the open Commit
   * modal. Requires `openCommitDialog()` to have been called first.
   * @returns The staged file names
   */
  async getStagedChanges(): Promise<string[]> {
    return this.readChangeRows("Staged changes");
  }

  /**
   * Reads the file names listed under "Unstaged changes" in the open
   * Commit modal. Requires `openCommitDialog()` to have been called first.
   * @returns The unstaged file names
   */
  async getUnstagedChanges(): Promise<string[]> {
    return this.readChangeRows("Unstaged changes");
  }

  /**
   * Stages a single file from the open Commit modal's unstaged list and
   * waits for it to move to the staged list. Requires `openCommitDialog()`
   * to have been called first.
   * @param fileName - The file name as listed in the modal, e.g. "foo.yaml"
   */
  async stageChange(fileName: string): Promise<void> {
    const row = this.changeRow("Unstaged changes", fileName);
    await row.hover();
    await row.locator('button[name="Stage change"]').click();
    await expect(this.changeRow("Staged changes", fileName)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Unstages a single file from the open Commit modal's staged list and
   * waits for it to move back to the unstaged list. Requires
   * `openCommitDialog()` to have been called first.
   * @param fileName - The file name as listed in the modal, e.g. "foo.yaml"
   */
  async unstageChange(fileName: string): Promise<void> {
    const row = this.changeRow("Staged changes", fileName);
    await row.hover();
    await row.locator('button[name="Unstage change"]').click();
    await expect(this.changeRow("Unstaged changes", fileName)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Unstages every staged file via the Commit modal's "Unstage all
   * changes" button and waits for the staged list to empty. Requires
   * `openCommitDialog()` to have been called first.
   */
  async unstageAllChanges(): Promise<void> {
    await this.commitDialog.locator('button[name="Unstage all changes"]').click();
    await expect(
      this.commitDialog.getByRole("heading", { name: /^Staged changes 0/ }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Discards a single unstaged file from the open Commit modal, confirming
   * the prompt, and waits for it to leave the unstaged list. Requires
   * `openCommitDialog()` to have been called first.
   * @param fileName - The file name as listed in the modal, e.g. "foo.yaml"
   */
  async discardChange(fileName: string): Promise<void> {
    const row = this.changeRow("Unstaged changes", fileName);
    await row.hover();
    await row.locator('button[name="Discard change"]').click();
    await this.page.getByTestId("discard-changes-confirm-button").click();
    await expect(row).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Whether the Commit modal's "Commit" button is currently disabled (it
   * is whenever nothing is staged). Requires `openCommitDialog()` to have
   * been called first.
   * @returns true if the Commit button is disabled
   */
  async isCommitDisabled(): Promise<boolean> {
    return this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .isDisabled();
  }

  /**
   * Fills `message` (if given) and clicks "Commit" on whatever is
   * currently staged, without staging anything first. Waits for the staged
   * list to empty rather than for the modal to close, since the modal
   * stays open while unstaged changes remain. Requires `openCommitDialog()`
   * to have been called first.
   * @param message - The commit message; omit to submit the empty form
   */
  async commitStaged(message?: string): Promise<void> {
    if (message !== undefined) {
      await this.commitDialog
        .getByRole("textbox", { name: "Message" })
        .fill(message);
    }
    await this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .click();
  }

  /**
   * Whether the Commit modal is currently open.
   * @returns true if the modal is visible
   */
  async isCommitDialogOpen(): Promise<boolean> {
    return this.commitDialog.isVisible();
  }

  /**
   * Waits until the Commit modal's staged list holds no files.
   */
  async waitForNothingStaged(): Promise<void> {
    await expect(
      this.commitDialog.getByRole("heading", { name: /^Staged changes 0/ }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
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
   * Opens the History modal via the Git Sync dropdown's "History" action.
   * Does not wait for the commit log itself to finish loading — `Table`'s
   * `renderEmptyState` renders both the "Loading..." and "No history
   * available" placeholders as a `role="row"` element indistinguishable
   * from a real commit row by role alone, so that has to be done by
   * `getLatestCommit()`, which can tell a real commit row apart from a
   * placeholder by its `data-key` attribute.
   */
  async openHistory(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu.getByText("History", { exact: true }).click();
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the id (git OID, exposed via the row's `data-key` attribute) and
   * message of the most recent commit from the open History modal — the
   * log lists commits newest-first, and the first row after the column
   * header is that newest commit. Requires `openHistory()` to have been
   * called first.
   *
   * Matched by `[data-key]` rather than by row position: the table's
   * loading/empty placeholder is also a `role="row"` element (see
   * `openHistory()`), so `getByRole("row").nth(1)` can match that
   * placeholder — which carries no `data-key` — instead of the first real
   * commit row while the log is still being fetched. Only actual data rows
   * get a `data-key`, so waiting for one to appear here doubles as waiting
   * for the log to finish loading.
   * @returns The latest commit's id and message, or undefined if the log is empty
   */
  async getLatestCommit(): Promise<
    { id: string; message: string } | undefined
  > {
    const row = this.historyDialog.locator('[role="row"][data-key]').first();
    try {
      await expect(row).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    } catch {
      return undefined;
    }
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
   * Submits `branch` in the Branches modal's "New branch name" field
   * without waiting for it to become the active branch — for names the app
   * is expected to reject. Requires `openBranchesDialog()` to have been
   * called first.
   * @param branch - The branch name to attempt to create
   */
  async submitNewBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByRole("textbox", { name: "New branch name:" })
      .fill(branch);
    await this.branchesDialog
      .getByRole("button", { name: "Create", exact: true })
      .click();
  }

  /**
   * Reads the validation error shown under the Branches modal's "New
   * branch name" field after a rejected `submitNewBranch()`. Waits for it
   * to appear. Requires `openBranchesDialog()` to have been called first.
   * @returns The error text
   */
  async getNewBranchError(): Promise<string> {
    const error = this.branchesDialog.locator("form p");
    await expect(error).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await error.innerText()).trim();
  }

  /**
   * Reads the names listed under "Local Branches" (without the current
   * branch's trailing " *"). Requires `openBranchesDialog()` to have been
   * called first.
   * @returns The local branch names
   */
  async getLocalBranches(): Promise<string[]> {
    return this.readBranchRows("Branches list");
  }

  /**
   * Reads the names listed under "Remote Branches" (remote-only branches).
   * Waits for the "Fetching remote branches..." placeholder to clear.
   * Requires `openBranchesDialog()` to have been called first.
   * @returns The remote-only branch names
   */
  async getRemoteBranches(): Promise<string[]> {
    await expect(
      this.branchesDialog.getByText("Fetching remote branches..."),
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return this.readBranchRows("Remote Branches list");
  }

  /**
   * Checks out a remote-only branch via its "Fetch and checkout" button and
   * waits for it to become the active branch. Requires
   * `openBranchesDialog()` to have been called first.
   * @param branch - The remote-only branch to check out
   */
  async checkoutRemoteBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByRole("grid", { name: "Remote Branches list", exact: true })
      .getByRole("row")
      .filter({ hasText: branch })
      .getByRole("button", { name: "Fetch and checkout" })
      .click();
    await expect(this.branchesDialog.getByText(`${branch} *`)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Resolves every conflicted file listed in the "Resolve conflicts" modal
   * by taking the same side for each (via "Take all current/incoming
   * changes" in the merge editor, confirming the prompt), then submits and waits for the modal to
   * close. Call after `mergeBranch()` or `pull()` hit conflicts.
   * @param version - "Current" keeps the local change, "Incoming" takes the merged-in one
   */
  async resolveMergeConflicts(version: "Current" | "Incoming"): Promise<void> {
    await expect(this.mergeConflictsDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    const rows = this.mergeConflictsDialog
      .getByRole("grid", { name: "Conflicted changes" })
      .getByRole("row");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await rows.nth(i).click();
      await this.mergeConflictsDialog
        .getByRole("button", {
          name: `Take all ${version.toLowerCase()} changes`,
        })
        .click();
      await this.page.getByRole("button", { name: "Confirm" }).click();
    }
    await this.mergeConflictsDialog
      .getByRole("button", { name: "Resolve conflicts" })
      .click();
    await expect(this.mergeConflictsDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
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

  private async readChangeRows(
    list: "Staged changes" | "Unstaged changes",
  ): Promise<string[]> {
    const rows = this.commitDialog
      .getByRole("grid", { name: list, exact: true })
      .locator('[role="row"][data-key]');
    const texts = await rows.allInnerTexts();
    return texts.map((text) => text.split("\n")[0].trim());
  }

  private async readBranchRows(
    list: "Branches list" | "Remote Branches list",
  ): Promise<string[]> {
    const rows = this.branchesDialog
      .getByRole("grid", { name: list, exact: true })
      .locator('[role="row"][data-key]');
    const texts = await rows.allInnerTexts();
    return texts.map((text) => text.split("\n")[0].replace(/\s*\*$/, "").trim());
  }

  private async openSyncMenu(): Promise<void> {
    await this.syncDropdownButton.click();
    await expect(this.syncMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
