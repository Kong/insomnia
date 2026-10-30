import { expect } from "@playwright/test";

import { GitChangeList } from "../enums/git-change-list";
import { GitDiffView } from "../enums/git-diff-view";
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
  private readonly stageAllPrompt = this.page
    .getByRole("dialog")
    .filter({ hasText: "Stage All Changes" });
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
   */
  async getCurrentBranch(): Promise<string> {
    return (await this.syncDropdownButton.innerText()).trim();
  }

  /**
   * Checks out `branch` directly from the Git Sync dropdown's branch list
   * (a faster path than opening the Branches modal), and waits for the
   * dropdown's label to show it as the current branch.
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
   * clears, and at least one change row is listed — `data-loading` is not yet
   * set in the instant before the fetch starts, so on its own it lets a
   * read of the still-empty staged/unstaged lists through; the item only
   * enables when something is uncommitted, so a row always appears).
   * Interacting with the modal while it's still loading is
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
    await expect(
      this.commitDialog.locator('[role="row"][data-key]').first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
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
   * Closes the Commit modal with its close (x) button. Escape is not used
   * because it only reaches the modal while focus is inside it, and focus
   * can fall back to the page body after a stage/unstage/commit re-render,
   * leaving the modal open. The click is retried in case the modal's
   * content is still re-rendering when it lands.
   */
  async closeCommitDialog(): Promise<void> {
    await expect(async () => {
      if (await this.commitDialog.isVisible()) {
        await this.commitDialog.locator('[data-icon="x"]').click();
      }
      await expect(this.commitDialog).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the file names listed under "Staged changes" in the open Commit
   * modal. Requires `openCommitDialog()` to have been called first.
   */
  async getStagedChanges(): Promise<string[]> {
    return this.readChangeRows("Staged changes");
  }

  /**
   * Reads the file names listed under "Unstaged changes" in the open
   * Commit modal. Requires `openCommitDialog()` to have been called first.
   */
  async getUnstagedChanges(): Promise<string[]> {
    return this.readChangeRows("Unstaged changes");
  }

  /**
   * Stages a single file from the open Commit modal's unstaged list and
   * waits for it to move to the staged list. Requires `openCommitDialog()`
   * to have been called first.
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
   */
  async discardChange(fileName: string): Promise<void> {
    const row = this.changeRow("Unstaged changes", fileName);
    await row.hover();
    await row.locator('button[name="Discard change"]').click();
    await this.page.getByTestId("discard-changes-confirm-button").click();
    await expect(row).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fills `message` (clearing the field when omitted, since it keeps its
   * previous text between attempts) and clicks "Commit" on whatever is
   * currently staged, without staging anything first. Waits for the staged
   * list to empty rather than for the modal to close, since the modal
   * stays open while unstaged changes remain. Requires `openCommitDialog()`
   * to have been called first.
   */
  async commitStaged(message?: string): Promise<void> {
    await this.commitDialog
      .getByRole("textbox", { name: "Message" })
      .fill(message ?? "");
    await this.commitDialog
      .getByRole("button", { name: "Commit", exact: true })
      .click();
  }

  /**
   * Whether the Commit modal is currently open.
   */
  async isCommitDialogOpen(): Promise<boolean> {
    return this.commitDialog.isVisible();
  }

  /**
   * Reads the text of the "Stage All Changes" prompt the Commit modal opens
   * when Commit is clicked with nothing staged. Waits for it to appear.
   */
  async getStageAllPromptText(): Promise<string> {
    await expect(this.stageAllPrompt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await this.stageAllPrompt.innerText()).replaceAll("\n", " ");
  }

  /**
   * Dismisses the "Stage All Changes" prompt with "Cancel", leaving the
   * Commit modal open and nothing committed.
   */
  async cancelStageAllPrompt(): Promise<void> {
    await this.stageAllPrompt.getByRole("button", { name: "Cancel" }).click();
    await expect(this.stageAllPrompt).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Accepts the "Stage All Changes" prompt with "Yes", which stages every
   * change and commits it, then waits for the Commit modal to close.
   */
  async confirmStageAllPrompt(): Promise<void> {
    await this.stageAllPrompt.getByTestId("stage-all-and-commit-confirm-button").click();
    await expect(this.commitDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
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
      this.branchesDialog.getByText("Fetching remote branches..."),
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return this.readBranchRows("Remote Branches list");
  }

  /**
   * Checks out a remote-only branch via its "Fetch and checkout" button and
   * waits for it to become the active branch. Requires
   * `openBranchesDialog()` to have been called first.
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

  private readonly discardDialog = this.page
    .getByRole('dialog')
    .filter({ has: this.page.getByRole('heading', { name: 'Discard Changes' }) });

  private readonly undiscardableWarning = this.page.getByText(
    'This change is only Insomnia internally reformatting the file',
  );

  private readonly unknownFieldsConfirmDialog = this.page
    .getByRole('dialog')
    .filter({ has: this.page.getByRole('heading', { name: 'Unrecognized Fields' }) });

  private readonly entityCard = (entityName: string, typeLabel?: string) => {
    const card = this.commitDialog
      .locator('div.border-l-2')
      .filter({ has: this.page.locator('span.font-semibold').getByText(entityName, { exact: true }) });
    return typeLabel ? card.filter({ has: this.page.getByText(typeLabel, { exact: true }) }) : card;
  };

  private readonly visualDiffNotice = this.commitDialog.getByText(
    /Unable to parse this file for a visual diff|No requests, folders, environments or settings changed|This is not a valid Insomnia file/,
  );

  /**
   * Clicks a file's row in the open Commit modal to open its diff, and
   * waits for the diff pane (its Stage/Unstage this-file button) to render
   * — the undiscardable flag arrives with the same loader data as the
   * diff, so once the pane is up the warning's presence is settled.
   * Requires `openCommitDialog()` to have been called first.
   */
  async openChangeDiff(list: GitChangeList, fileName: string): Promise<void> {
    await this.changeRow(list, fileName).click();
    await expect(
      this.commitDialog.getByRole('button', {
        name: list === GitChangeList.Staged ? 'Unstage this file' : 'Stage this file',
      }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Switches the open Commit modal's diff pane between the Text and Visual
   * (Beta) views. Requires `openChangeDiff()` to have been called first.
   */
  async switchDiffView(view: GitDiffView): Promise<void> {
    await this.commitDialog.getByRole('button', { name: view, exact: true }).click();
  }

  /**
   * Reads which diff view the open Commit modal's diff pane is showing,
   * from the view switch's highlighted button.
   */
  async getDiffView(): Promise<GitDiffView> {
    const visualClass = (await this.commitDialog.getByRole('button', { name: GitDiffView.Visual, exact: true }).getAttribute('class')) ?? '';
    return visualClass.includes('bg-(--hl-sm)') ? GitDiffView.Visual : GitDiffView.Text;
  }

  /**
   * Reads whether the diff pane's view switch offers a given view.
   */
  async hasDiffViewOption(view: GitDiffView): Promise<boolean> {
    return this.commitDialog.getByRole('button', { name: view, exact: true }).isVisible();
  }

  /**
   * Waits for the Visual view to settle (cards, or one of its notices) and
   * reads every entity card's name, in display order. Requires the Visual
   * view to be showing.
   */
  async getEntityCardNames(): Promise<string[]> {
    await this.commitDialog
      .locator('div.border-l-2')
      .first()
      .or(this.visualDiffNotice)
      .waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    const cards = this.commitDialog.locator('div.border-l-2');
    const count = await cards.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push((await cards.nth(i).locator('span.font-semibold').first().innerText()).trim());
    }
    return result;
  }

  /**
   * Reads the action buttons shown on an entity's card, e.g. ["Discard", "Stage"].
   */
  async getEntityCardActions(entityName: string, typeLabel?: string): Promise<string[]> {
    const labels = await this.entityCard(entityName, typeLabel).getByRole('button').allInnerTexts();
    return labels.map(label => label.trim()).filter(label => /^(Stage|Unstage|Discard|Confirm.*)$/.test(label));
  }

  /**
   * Reads the full text of an entity's card (header, tabs, field diffs).
   */
  async getEntityCardText(entityName: string, typeLabel?: string): Promise<string> {
    return (await this.entityCard(entityName, typeLabel).innerText()).trim();
  }

  /**
   * Reads the change-section tab labels on an entity's card, e.g. ["Params 1", "Headers 2"].
   */
  async getEntityCardTabs(entityName: string, typeLabel?: string): Promise<string[]> {
    const labels = await this.entityCard(entityName, typeLabel).getByRole('tab').allInnerTexts();
    return labels.map(label => label.replaceAll('\n', ' ').trim());
  }

  /**
   * Selects a change-section tab on an entity's card.
   */
  async selectEntityCardTab(entityName: string, tab: string, typeLabel?: string): Promise<void> {
    await this.entityCard(entityName, typeLabel).getByRole('tab', { name: new RegExp(`^\\s*${tab.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
  }

  /**
   * Reads a card's header: its method badge, name and URL texts, and
   * whether the three share one line (their boxes overlap vertically).
   * Only meaningful for cards with a badge and URL, e.g. a request's.
   */
  async getEntityCardHeader(entityName: string): Promise<{ badge: string; name: string; url: string; onOneLine: boolean }> {
    const header = this.entityCard(entityName).locator('div.items-baseline').first();
    const badge = header.locator('span').nth(0);
    const name = header.locator('span.font-semibold');
    const url = header.locator('span.font-mono');
    const boxes = [await badge.boundingBox(), await name.boundingBox(), await url.boundingBox()];
    const onOneLine = boxes.every(
      box => box !== null && box.y < boxes[1]!.y + boxes[1]!.height && box.y + box.height > boxes[1]!.y,
    );
    return {
      badge: (await badge.innerText()).trim(),
      name: (await name.innerText()).trim(),
      url: (await url.innerText()).trim(),
      onOneLine,
    };
  }

  /**
   * Scrolls an entity card's (optionally tab-selected) long-value diff into
   * view, waits for its lazily created Monaco diff editor, and reads how
   * it rendered: how many editors, how many folded unchanged regions, and
   * how many lines the changed (right) side actually draws.
   */
  async getEntityCardCompactDiff(
    entityName: string,
    tab?: string,
    typeLabel?: string,
  ): Promise<{ editors: number; foldedRegions: number; drawnLines: number }> {
    const card = this.entityCard(entityName, typeLabel);
    if (tab) {
      await this.selectEntityCardTab(entityName, tab, typeLabel);
    }
    const editor = card.locator('.monaco-diff-editor').first();
    // The app only creates the Monaco editor once its (empty) container is within 300px of the
    // viewport, so there is nothing to scroll to yet: bring the card itself into view first.
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('tabpanel').first().scrollIntoViewIfNeeded();
    await expect(editor).toBeAttached({ timeout: DEFAULT_TIMEOUT });
    await editor.scrollIntoViewIfNeeded();
    await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(editor.locator('.diff-hidden-lines').first()).toBeAttached({ timeout: DEFAULT_TIMEOUT });
    return {
      editors: await card.locator('.monaco-diff-editor').count(),
      foldedRegions: await editor.locator('.diff-hidden-lines').count(),
      drawnLines: await editor.locator('.modified .view-line').count(),
    };
  }

  /**
   * Reads whether an entity card currently shows a compact Monaco diff
   * (long values) rather than the plain inline before/after form.
   */
  async hasEntityCardCompactDiff(entityName: string, typeLabel?: string): Promise<boolean> {
    return (await this.entityCard(entityName, typeLabel).locator('.monaco-diff-editor').count()) > 0;
  }

  /**
   * Reads the Visual view's "N entities changed" summary line.
   */
  async getEntitySummary(): Promise<string> {
    return (await this.commitDialog.getByText(/^\d+ (entity|entities) changed$/).innerText()).trim();
  }

  /**
   * Stages one entity from its card in the Visual view (Unstaged side) and
   * waits for its card to leave the list.
   */
  async stageEntity(entityName: string, typeLabel?: string): Promise<void> {
    await this.entityCard(entityName, typeLabel).getByRole('button', { name: 'Stage', exact: true }).click();
    await expect(this.entityCard(entityName, typeLabel)).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads whether an entity card's Stage button is enabled.
   */
  async isEntityStageEnabled(entityName: string, typeLabel?: string): Promise<boolean> {
    return this.entityCard(entityName, typeLabel).getByRole('button', { name: 'Stage', exact: true }).isEnabled();
  }

  /**
   * Clicks Stage on several entities' cards within one browser task, i.e.
   * before the Visual view can re-render in between — the way a fast
   * double click would — then waits for the first entity's card to leave
   * the list. Every click after the first lands while its action is still
   * pending.
   */
  async stageEntitiesInQuickSuccession(entityNames: string[]): Promise<void> {
    await this.commitDialog.evaluate((root, names) => {
      for (const name of names) {
        const card = [...root.querySelectorAll('div.border-l-2')].find(candidate =>
          [...candidate.querySelectorAll('span.font-semibold')].some(span => span.textContent?.trim() === name),
        );
        const button = [...(card?.querySelectorAll('button') ?? [])].find(candidate => candidate.textContent?.trim() === 'Stage');
        button?.click();
      }
    }, entityNames);
    await expect(this.entityCard(entityNames[0])).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks Stage on an entity's card and then "Stage this file" within one
   * browser task, so the file-level action fires while the entity action is
   * still pending.
   */
  async stageEntityThenFileInQuickSuccession(entityName: string): Promise<void> {
    await this.commitDialog.evaluate((root, name) => {
      const card = [...root.querySelectorAll('div.border-l-2')].find(candidate =>
        [...candidate.querySelectorAll('span.font-semibold')].some(span => span.textContent?.trim() === name),
      );
      const entityButton = [...(card?.querySelectorAll('button') ?? [])].find(candidate => candidate.textContent?.trim() === 'Stage');
      const fileButton = [...root.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === 'Stage this file');
      entityButton?.click();
      fileButton?.click();
    }, entityName);
  }

  /**
   * Unstages one entity from its card in the Visual view (Staged side) and
   * waits for its card to leave the list.
   */
  async unstageEntity(entityName: string, typeLabel?: string): Promise<void> {
    await this.entityCard(entityName, typeLabel).getByRole('button', { name: 'Unstage', exact: true }).click();
    await expect(this.entityCard(entityName, typeLabel)).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks Discard on an entity's card, without confirming. The button
   * turns into a confirmation prompt that lapses after about 2 seconds.
   */
  async startEntityDiscard(entityName: string, typeLabel?: string): Promise<void> {
    const confirmButton = this.entityCard(entityName, typeLabel).getByRole('button').filter({ hasText: /^Confirm/ });
    await expect(async () => {
      await this.entityCard(entityName, typeLabel).getByRole('button', { name: 'Discard', exact: true }).click();
      await expect(confirmButton).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the label of the confirmation prompt shown after
   * `startEntityDiscard()`, e.g. "Confirm" or "Confirm (discards its contents too)".
   */
  async getEntityDiscardConfirmLabel(entityName: string, typeLabel?: string): Promise<string> {
    return (await this.entityCard(entityName, typeLabel).getByRole('button').filter({ hasText: /^Confirm/ }).innerText()).trim();
  }

  /**
   * Confirms a pending entity discard and waits for its card to leave the list.
   */
  async confirmEntityDiscard(entityName: string, typeLabel?: string): Promise<void> {
    await this.entityCard(entityName, typeLabel).getByRole('button').filter({ hasText: /^Confirm/ }).click();
    await expect(this.entityCard(entityName, typeLabel)).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Waits for an entity's confirmation prompt to lapse back to "Discard".
   */
  async waitForEntityDiscardPromptToLapse(entityName: string, typeLabel?: string): Promise<void> {
    await expect(this.entityCard(entityName, typeLabel).getByRole('button', { name: 'Discard', exact: true })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads whether an entity has a card in the Visual view right now.
   */
  async isEntityCardVisible(entityName: string, typeLabel?: string): Promise<boolean> {
    return this.entityCard(entityName, typeLabel).isVisible();
  }

  /**
   * Reads the notice the Visual view shows instead of cards ("Unable to
   * parse this file for a visual diff." or "No requests, folders,
   * environments or settings changed…"). Waits for it to appear.
   */
  async getVisualDiffNotice(): Promise<string> {
    const notice = this.visualDiffNotice.locator('xpath=..');
    await expect(notice).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await notice.innerText()).replaceAll('\n', ' ').trim();
  }

  /**
   * Reads the warning the Visual view shows above its cards when a file
   * isn't in the format Insomnia writes ("This file isn't in the format
   * Insomnia writes…"). The check runs in the background after the cards
   * render, so this waits for the warning to appear.
   */
  async getVisualDiffFormatWarning(): Promise<string> {
    const warning = this.commitDialog.getByTestId('visual-diff-format-warning');
    await expect(warning).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await warning.innerText()).replaceAll('\n', ' ').trim();
  }

  /**
   * Clicks the "Open the Text view" link in the Visual view's format warning.
   */
  async openTextViewFromWarning(): Promise<void> {
    await this.commitDialog.getByTestId('visual-diff-format-warning').getByRole('button', { name: 'Open the Text view' }).click();
  }

  /**
   * Reads whether the Visual view shows no format warning once its
   * background format check has had time to finish. Requires the cards or
   * a notice to be showing.
   */
  async isVisualDiffFormatWarningAbsent(): Promise<boolean> {
    return !(await this.commitDialog.getByTestId('visual-diff-format-warning').isVisible());
  }

  /**
   * Clicks the "Open the Text view" link in a Visual view notice.
   */
  async openTextViewFromNotice(): Promise<void> {
    await this.commitDialog.getByRole('button', { name: 'Open the Text view' }).click();
  }

  /**
   * Reads the title and description of the error toast an entity action
   * raises ("Failed to stage/unstage/discard changes").
   */
  async getErrorToastText(): Promise<string> {
    const toast = this.page.getByText(/Failed to (stage|unstage|discard) changes/);
    await expect(toast).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await toast.innerText()).trim();
  }

  /**
   * Reads whether the open Commit modal's diff pane shows the "can't be
   * discarded" warning. Requires `openChangeDiff()` to have been called.
   */
  async isUndiscardableWarningVisible(): Promise<boolean> {
    return this.commitDialog.getByText('This change is only Insomnia internally reformatting the file').isVisible();
  }

  /**
   * Clicks Discard on a file's row and waits for the confirmation dialog,
   * without confirming. Requires `openCommitDialog()` to have been called.
   */
  async openDiscardConfirmation(fileName: string): Promise<void> {
    const row = this.changeRow(GitChangeList.Unstaged, fileName);
    await row.hover();
    await row.locator('button[name="Discard change"]').click();
    await expect(this.discardDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks "Discard all changes" on the Unstaged changes heading and waits
   * for the confirmation dialog, without confirming. Requires
   * `openCommitDialog()` to have been called.
   */
  async openDiscardAllConfirmation(): Promise<void> {
    await this.commitDialog.locator('button[name="Discard all changes"]').click();
    await expect(this.discardDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the open Discard confirmation dialog's body text.
   */
  async getDiscardConfirmationText(): Promise<string> {
    return (await this.discardDialog.innerText()).trim();
  }

  /**
   * Reads whether the open Discard confirmation dialog shows the "can't be
   * discarded" warning.
   */
  async isUndiscardableWarningVisibleInDiscardDialog(): Promise<boolean> {
    return this.discardDialog.getByText('This change is only Insomnia internally reformatting the file').isVisible();
  }

  /**
   * Reads whether the open Commit modal's diff pane shows the unknown
   * fields banner. Requires `openChangeDiff()` to have been called.
   */
  async isUnknownFieldsDiffWarningVisible(): Promise<boolean> {
    return this.commitDialog.getByTestId('unknown-fields-diff-warning').isVisible();
  }

  /**
   * Reads the unknown fields banner's text from the open Commit modal's diff pane.
   */
  async getUnknownFieldsDiffWarningText(): Promise<string> {
    const banner = this.commitDialog.getByTestId('unknown-fields-diff-warning');
    return (await banner.isVisible()) ? (await banner.innerText()).trim() : '';
  }

  /**
   * Counts the diff editor's highlighted unknown-field lines in the open
   * Commit modal. Only lines currently rendered in the editor's viewport are
   * counted (the editor renders just the visible lines), so a field further
   * down a long file is not seen — use
   * `getUnknownFieldHighlightCountAcrossDiff()` for that. Requires
   * `openChangeDiff()` to have been called.
   */
  async getUnknownFieldHighlightCount(): Promise<number> {
    return this.commitDialog.locator('.unknown-field-line-bg').count();
  }

  /**
   * Counts the diff editor's highlighted unknown-field lines across the whole
   * file by scrolling it from the top to the bottom, so a field anywhere in
   * the file is seen however small the editor is (in a short Commit modal it
   * shows only a few lines, with the unchanged ones folded away). Lines
   * visible from two adjacent scroll positions may be counted twice, so use
   * it for "any highlight" checks rather than an exact line count. Scrolls
   * with the mouse wheel rather than the keyboard, as moving the cursor does
   * not scroll an editor that short. Requires `openChangeDiff()` to have been
   * called.
   */
  async getUnknownFieldHighlightCountAcrossDiff(): Promise<number> {
    const diffEditor = this.commitDialog.locator('.monaco-diff-editor').first();
    const viewLines = diffEditor.locator('.view-lines');
    await diffEditor.hover();
    await this.page.mouse.wheel(0, -100_000);
    let total = 0;
    let previousText = '';
    // No step cap: the loop ends when scrolling stops changing what is visible (the test timeout bounds it otherwise).
    for (let step = 0; ; step++) {
      await this.page.waitForTimeout(300);
      let previous = -1;
      let stableReads = 0;
      let count = 0;
      // The decorations render a beat after the editor's lines do, so an early 0 is not "settled":
      // give the first position's highlight a grace period, then require the count to stop changing.
      const deadlineForFirstHighlight = Date.now() + DEFAULT_TIMEOUT / 2;
      await expect(async () => {
        count = await this.getUnknownFieldHighlightCount();
        stableReads = count === previous ? stableReads + 1 : 0;
        previous = count;
        const hasWaitedEnough = step > 0 || count > 0 || Date.now() > deadlineForFirstHighlight;
        expect(stableReads >= 2 && hasWaitedEnough).toBe(true);
      }).toPass({ timeout: DEFAULT_TIMEOUT, intervals: [200] });
      total += count;

      const text = (await viewLines.allInnerTexts()).join('\n');
      if (text === previousText) break; // the wheel no longer scrolls: reached the bottom
      previousText = text;
      // A step well under the editor's visible height, so no line is skipped between positions.
      await this.page.mouse.wheel(0, 40);
    }
    return total;
  }

  /**
   * Reads whether the "Unrecognized Fields" confirmation is open, as shown
   * when committing a file whose committed version has unknown fields.
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
    await this.unknownFieldsConfirmDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(this.unknownFieldsConfirmDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Continues past the open "Unrecognized Fields" confirmation, creating
   * the commit.
   */
  async confirmUnknownFieldsCommit(): Promise<void> {
    await this.page.getByTestId('unknown-fields-commit-confirm-button').click();
    await expect(this.unknownFieldsConfirmDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Confirms the open Discard dialog without waiting for the file to leave
   * the unstaged list (a file whose change can't be discarded comes back).
   */
  async confirmDiscard(): Promise<void> {
    await this.page.getByTestId('discard-changes-confirm-button').click();
    await expect(this.discardDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Cancels the open Discard confirmation dialog.
   */
  async cancelDiscard(): Promise<void> {
    await this.discardDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(this.discardDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads whether the Git Sync menu's "Commit" item is enabled, i.e.
   * whether anything is uncommitted. Opens and closes the menu.
   */
  async hasUncommittedChanges(): Promise<boolean> {
    await this.openSyncMenu();
    const enabled = await this.syncMenu.getByRole('menuitemradio', { name: 'Commit', exact: true }).isEnabled();
    await this.page.keyboard.press('Escape');
    await expect(this.syncMenu).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return enabled;
  }

  /**
   * Fills `message` and clicks "Commit and push" on whatever is currently
   * staged, without staging anything first and without waiting for the
   * modal to close, so a confirmation raised by the click (e.g. the
   * "Unrecognized Fields" one) can be handled by the caller. Requires
   * `openCommitDialog()` to have been called first.
   */
  async commitStagedAndPush(message: string): Promise<void> {
    await this.commitDialog.getByRole('textbox', { name: 'Message' }).fill(message);
    await this.commitDialog.getByRole('button', { name: 'Commit and push' }).click();
  }

  /**
   * Clicks "Generate Commits" in the Commit modal's Smart commits card and
   * waits for the generated commit groups to replace the manual form.
   * Needs an active AI backend, the Smart Commits setting on, and nothing
   * staged. Requires `openCommitDialog()` to have been called first.
   */
  async generateCommits(): Promise<void> {
    await this.commitDialog.getByRole('button', { name: 'Generate Commits' }).click();
    await expect(this.commitDialog.getByRole('button', { name: 'Back to manual commits' })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks "Commit" (or "Commit and push") on the generated commit groups
   * without waiting for the modal to close, so a confirmation raised by the
   * click can be handled by the caller. Requires `generateCommits()` first.
   */
  async submitGeneratedCommits(push = false): Promise<void> {
    await this.commitDialog
      .getByRole('button', { name: push ? 'Commit and push' : 'Commit', exact: true })
      .click();
  }

  /**
   * Accepts the "Stage All Changes" prompt with "Yes" without waiting for the
   * Commit modal to close, for when another confirmation (e.g. unknown
   * fields) follows and keeps the modal open.
   */
  async acceptStageAllPrompt(): Promise<void> {
    await this.stageAllPrompt.getByTestId('stage-all-and-commit-confirm-button').click();
    await expect(this.stageAllPrompt).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Waits until a commit has gone through: the Commit modal either closed
   * (nothing left to commit) or still shows an empty staged list. A modal
   * with nothing left to show closes itself shortly after the commit, so
   * when it's still open this also gives it a moment to do so — closing it
   * by hand while the commit is still being written is unreliable.
   */
  async waitForCommitToFinish(): Promise<void> {
    await expect(async () => {
      const isClosed = !(await this.commitDialog.isVisible());
      const isStagedEmpty = await this.commitDialog.getByRole('heading', { name: /^Staged changes 0/ }).isVisible();
      expect(isClosed || isStagedEmpty).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await this.commitDialog.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT / 2 }).catch(() => {});
  }
}
