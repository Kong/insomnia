import { expect } from "@playwright/test";

import { SyncStatus } from "../enums/sync-status";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

export enum DialogDismissMethod {
  XButton,
  Escape,
  ClickOutside,
}

export class CloudSyncPage extends BasePage {
  navigate(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  // Cloud Sync's sync dropdown reuses the exact same testid/aria-label as
  // Git Sync's (confirmed live: both `sync-dropdown.tsx` and
  // `git-sync-dropdown.tsx` render `data-testid="git-dropdown"`,
  // `aria-label="Git Sync"` — which one mounts depends on whether the
  // active workspace's project is Cloud-synced or has a git repo attached).
  private readonly syncDropdownButton = this.page.getByTestId("git-dropdown");
  private readonly syncMenu = this.page.getByRole("menu", { name: "Git Sync" });
  private readonly commitDialog = this.page.getByRole("dialog", {
    name: "Commit changes",
  });
  private readonly branchesDialog = this.page.getByRole("dialog", {
    name: "Branches",
  });
  private readonly historyDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "History" }) });
  private readonly deleteFileDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "Delete file" }) });

  /**
   * A project dashboard's own grid card for `name` (a react-aria
   * `GridList` row, confirmed live — the `GridListItem` renders no
   * `data-testid` of its own, only an accessible name from its
   * `textValue`). Scoped to the grid's own `data-testid="workspace-grid"`
   * container — confirmed live: an unfetched fixture's sidebar
   * "unsynced" tree row carries the exact same accessible name and role,
   * so an unscoped `getByRole("row", { name })` hits a strict-mode
   * violation once the sidebar tree is showing that row too.
   * @param name - The card's file/collection name
   */
  private fileCard(name: string) {
    return this.page.getByTestId("workspace-grid").getByRole("row", { name });
  }

  /**
   * Waits for the project dashboard's file/collection grid to finish its
   * async remote-files query and render at least one card — confirmed
   * live: right after navigating in, `data-testid="workspace-grid"`
   * exists but is still empty for a beat, so reading `hasFileDeleteButton()`
   * immediately after navigating can race a still-loading grid.
   */
  async waitForDashboardLoaded(): Promise<void> {
    await expect(
      this.page.getByTestId("workspace-grid").getByRole("row").first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fetches a workspace that only exists on the Cloud Sync backend
   * (rendered in the sidebar as an "unsynced" row under its Cloud project)
   * into the local sidebar, then navigates into it. Requires the
   * project's "unsynced" row to currently be visible — call
   * `backToAllProjects()` first if another workspace's collection-focus
   * mode is hiding it.
   * @param name - The unsynced workspace's name, e.g. "My Collection R1"
   */
  async fetchUnsyncedWorkspace(name: string): Promise<void> {
    const unsyncedRow = this.page.getByTestId(
      `unsynced-workspace-node-${name}`,
    );
    await unsyncedRow
      .getByRole("button", { name: "Fetch unsynced workspace" })
      .click();
    await expect(unsyncedRow).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    const workspaceRow = this.page.getByTestId(`workspace-node-${name}`);
    await expect(workspaceRow).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await workspaceRow.click();
  }

  /**
   * Re-clicks a workspace's own sidebar row, without going through the
   * "unsynced" fetch path — used to re-trigger the workspace route's own
   * data loader (e.g. right before simulating a main-window focus change,
   * so the background "check for remote changes" logic has fresh route
   * data to act on).
   * @param name - The workspace's name
   */
  async reselect(name: string): Promise<void> {
    await this.page.getByTestId(`workspace-node-${name}`).first().click();
  }

  /**
   * Reads which sidebar row currently represents `name` — the real,
   * locally-present workspace node, or the "unsynced" placeholder row
   * left behind after removing just the local copy. The two are visually
   * indistinguishable by name alone (same accessible name, different
   * testid — a plain by-name tree lookup like `workspaceFlow.getCollection()`
   * can't tell them apart), so this checks each row's own testid directly.
   * @param name - The workspace's name
   * @returns The workspace's current sync status, or undefined if neither row is present (e.g. after a full delete)
   */
  async isSynced(name: string): Promise<SyncStatus | undefined> {
    if (await this.page.getByTestId(`workspace-node-${name}`).isVisible()) {
      return SyncStatus.Synced;
    }
    if (
      await this.page.getByTestId(`unsynced-workspace-node-${name}`).isVisible()
    ) {
      return SyncStatus.Unsynced;
    }
    return undefined;
  }

  /**
   * Exits sidebar collection-focus mode (narrowed to one workspace) if
   * currently active, restoring the full project tree — needed before
   * fetching a different unsynced workspace under the same project, since
   * focus mode hides every other row.
   */
  async backToAllProjects(): Promise<void> {
    const backButton = this.page.getByLabel("Back to all projects");
    if (await backButton.isVisible().catch(() => false)) {
      await backButton.click();
    }
  }

  /**
   * Opens the sync dropdown menu.
   */
  private async openSyncMenu(): Promise<void> {
    await this.syncDropdownButton.click();
    await expect(this.syncMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Discards every uncommitted change via the sync dropdown's "Discard
   * all changes" action, once it's no longer disabled.
   *
   * The click only submits an async fetcher action (rollback to the last
   * snapshot) — the local database revert lands some time after the click
   * resolves. Confirmed live gotchas, both required to reliably observe
   * the reverted state afterward:
   * - Reloading (or otherwise tearing down the renderer) before the
   *   rollback lands can abort it entirely, leaving the pre-discard value
   *   in place permanently — so this re-opens the sync menu and waits for
   *   "Discard all changes" to read as not-disabled again before
   *   returning, giving the fetcher a real round trip to settle first.
   * - Separately, an already-open request editor pane does NOT refresh
   *   its own CodeMirror buffer once the revert *has* landed — re-reading
   *   `httpRequestPage.getBody()` (even re-navigating to the same request
   *   via `httpRequestFlow.get()`, a no-op click on an already-active tab)
   *   keeps returning the stale pre-discard text. Force a full
   *   `page.reload()` before re-navigating to the request to get a fresh
   *   read. The same staleness applies to `restoreSnapshot()` below.
   */
  async discardAllChanges(): Promise<void> {
    await this.openSyncMenu();
    const discardButton = this.syncMenu.getByRole("menuitemradio", {
      name: "Discard all changes",
    });
    await expect(discardButton).not.toHaveAttribute("aria-disabled", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
    await discardButton.click({ delay: 500 });

    await this.openSyncMenu();
    await expect(discardButton).not.toHaveAttribute("aria-disabled", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
    await this.page.keyboard.press("Escape");
  }

  /**
   * Opens the Commit modal via the sync dropdown's "Commit" action.
   */
  async openCommitDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Commit", exact: true })
      .click({ delay: 500 });
    await expect(this.commitDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Stages one unstaged change by its row name (e.g. a request's name) in
   * the open Commit modal. Requires `openCommitDialog()` to have been
   * called first.
   * @param name - The unstaged row's visible name
   */
  private async stageChange(name: string): Promise<void> {
    await this.commitDialog
      .getByRole("row", { name })
      .locator('[data-icon="plus"]')
      .click();
  }

  /**
   * Stages `name`, fills the commit message, and commits + pushes in one
   * action. Requires `openCommitDialog()` to have been called first.
   * @param name - The single unstaged row to stage before committing
   * @param message - The commit message
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

  /**
   * Reads whether the sync dropdown's "Commit" action is currently
   * disabled (no staged/unstaged changes left) — opens the menu to check,
   * then closes it again.
   * @returns Whether "Commit" is disabled
   */
  async isCommitDisabled(): Promise<boolean> {
    await this.openSyncMenu();
    const disabled =
      (await this.syncMenu
        .getByRole("menuitemradio", { name: "Commit", exact: true })
        .getAttribute("aria-disabled")) === "true";
    await this.page.keyboard.press("Escape");
    return disabled;
  }

  /**
   * Opens the History modal via the sync dropdown's "History" action,
   * once it's no longer disabled.
   */
  async openHistory(): Promise<void> {
    await this.openSyncMenu();
    const historyButton = this.syncMenu.getByRole("menuitemradio", {
      name: "History",
      exact: true,
    });
    await expect(historyButton).not.toHaveAttribute("aria-disabled", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
    await historyButton.click();
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Restores the snapshot whose row displays `message` (its commit
   * message) in the open History modal, via its 2-click confirm. Requires
   * `openHistory()` to have been called first.
   * @param message - The snapshot's commit message, as shown in its row
   */
  async restoreSnapshot(message: string): Promise<void> {
    await this.historyDialog
      .getByRole("row", { name: message })
      .getByRole("button", { name: "Restore" })
      .dblclick();
  }

  /**
   * Closes the History modal.
   */
  async closeHistory(): Promise<void> {
    await this.historyDialog.locator('[data-icon="x"]').click();
    await expect(this.historyDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the Branches modal via the sync dropdown's "Branches" action.
   */
  async openBranchesDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Branches", exact: true })
      .click();
    await expect(this.branchesDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fetches a remote-only branch into the local branches list, from its
   * row in the Branches modal's "Remote Branches list". Requires
   * `openBranchesDialog()` to have been called first.
   * @param branch - The remote branch to fetch
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
   * @param branch - The local branch to check out
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
   * @param branch - The local branch to delete
   */
  async deleteLocalBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Delete" })
      .dblclick();
  }

  /**
   * Whether local branch `branch`'s "Delete" button is currently
   * disabled (e.g. because it's the currently checked-out branch).
   * Requires `openBranchesDialog()` to have been called first.
   * @param branch - The local branch to check
   * @returns Whether its "Delete" button is disabled
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
   * @param branch - The local branch to merge in
   */
  async mergeBranch(branch: string): Promise<void> {
    await this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .getByRole("button", { name: "Merge" })
      .dblclick();
  }

  /**
   * Whether `branch` is currently listed in the Branches modal's local
   * "Branches list". Requires `openBranchesDialog()` to have been called
   * first.
   * @param branch - The local branch to check for
   * @returns Whether it's currently listed
   */
  async isLocalBranchListed(branch: string): Promise<boolean> {
    return this.branchesDialog
      .getByLabel("Branches list", { exact: true })
      .getByLabel(branch, { exact: true })
      .isVisible();
  }

  /**
   * Creates a new local branch from the Branches modal's "New branch
   * name" field. Requires `openBranchesDialog()` to have been called
   * first.
   * @param branch - The new branch's name
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
   * Closes the Branches modal.
   */
  async closeBranchesDialog(): Promise<void> {
    await this.branchesDialog.locator('[data-icon="x"]').click();
    await expect(this.branchesDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the sync dropdown and waits for its "Pull" action to become
   * enabled (reflecting a detected remote commit), then reads back its
   * current label — plain "Pull" when there's nothing to pull, or
   * "Pull N Commit(s)" once one is detected. Leaves the menu open;
   * call `closeSyncMenu()` afterward.
   * @returns The "Pull" action's current visible label
   */
  async waitForPullAvailable(): Promise<string> {
    await this.openSyncMenu();
    const pullButton = this.syncMenu.getByRole("menuitemradio", {
      name: /^Pull/,
    });
    await expect(pullButton).not.toHaveAttribute("aria-disabled", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
    return (await pullButton.innerText()).trim();
  }

  /**
   * Closes the sync dropdown menu via Escape.
   */
  async closeSyncMenu(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.syncMenu).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the sync dropdown's "Pull" menu action — requires
   * `waitForPullAvailable()` to have already opened the menu and confirmed
   * it's enabled. The click itself resolves as soon as the item is
   * selected, well before the pull it kicks off (a remote fetch followed by
   * local blob/snapshot/branch writes) actually completes.
   */
  async clickPull(): Promise<void> {
    await this.syncMenu.getByRole("menuitemradio", { name: /^Pull/ }).click();
  }

  /**
   * Opens `name`'s workspace-actions dropdown from its sidebar row and
   * clicks "Delete", opening the delete-workspace dialog.
   * @param name - The workspace's name
   */
  async openDeleteWorkspaceDialog(name: string): Promise<void> {
    const workspaceRow = this.page.getByTestId(`workspace-node-${name}`);
    await workspaceRow.hover();
    await workspaceRow.getByLabel("SideBar Workspace Actions").click();
    await this.page
      .getByRole("menuitemradio", { name: "Delete", exact: true })
      .click();
  }

  /**
   * Confirms the open delete-workspace dialog with "Remove Local Copy"
   * selected (the default) — deletes only the local copy, leaving the
   * project intact on the Cloud Sync backend.
   */
  async deleteWorkspaceLocalOnly(): Promise<void> {
    await this.page.getByRole("button", { name: "Delete Workspace" }).click();
  }

  /**
   * Selects "Delete Permanently" in the open delete-workspace dialog and
   * confirms — deletes the workspace both locally and on the Cloud Sync
   * backend.
   */
  async deleteWorkspacePermanently(): Promise<void> {
    await this.page
      .locator("label")
      .filter({
        has: this.page.getByRole("heading", { name: "Delete Permanently" }),
      })
      .click();
    await this.page.getByRole("button", { name: "Delete Workspace" }).click();
  }

  /**
   * Hovers a project dashboard card by its file/collection name.
   * @param name - The card's name
   */
  async hoverFile(name: string): Promise<void> {
    await this.fileCard(name).hover();
  }

  /**
   * Focuses a project dashboard card by its file/collection name —
   * `GridListItem` uses roving tabindex, so this lands focus on the card
   * itself, the same element a real Tab/arrow-key traversal would land
   * on, rather than a descendant.
   * @param name - The card's name
   */
  async focusFile(name: string): Promise<void> {
    await this.fileCard(name).focus();
  }

  /**
   * Whether `name`'s dashboard card renders a delete ("trash") button at
   * all — confirmed live: it's conditionally rendered only for cards with
   * `scope === 'unsynced' && remoteId`, not merely hidden via CSS, so a
   * synced or local-only card has zero matching elements rather than one
   * with `opacity: 0`. An unsynced card's row itself can render a beat
   * after local ones (its remote-files query resolves asynchronously), so
   * this waits for the row to attach first rather than reading `count()`
   * immediately — a bare immediate read raced that query and produced a
   * false negative on a genuinely-unsynced card, confirmed live.
   * @param name - The card's name
   */
  async hasFileDeleteButton(name: string): Promise<boolean> {
    const card = this.fileCard(name);
    await card
      .waitFor({ state: "attached", timeout: DEFAULT_TIMEOUT })
      .catch(() => {});
    return (await card.getByLabel("Delete unsynced file").count()) > 0;
  }

  /**
   * Whether an unsynced card's delete button is currently visually
   * revealed. Confirmed live: the button always exists in the DOM (see
   * `hasFileDeleteButton()`) but sits at `opacity: 0` until the card is
   * hovered or focused (Tailwind `group-hover`/`group-focus`), animated by
   * a `transition-all` — reading `getComputedStyle` once right after
   * hover/focus can catch it mid-transition, so this polls via
   * `toHaveCSS` instead of a single read. That poll only confirms the
   * button *reached* opacity 1, though — reading right after an action
   * that's expected to hide it again (moving hover elsewhere, blurring)
   * can still catch the outgoing transition's stale "1" before it's had
   * time to animate back down, confirmed live. This waits out the
   * transition (Tailwind's default 150ms) before taking a single settled
   * reading, rather than polling toward an assumed target value.
   * @param name - The card's name
   */
  async isFileDeleteButtonRevealed(name: string): Promise<boolean> {
    const button = this.fileCard(name).getByLabel("Delete unsynced file");
    await this.page.waitForTimeout(300);
    const opacity = await button.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    return Number(opacity) > 0.5;
  }

  /**
   * Whether `name`'s dashboard card is currently listed at all — true for
   * a synced/local-only/unsynced card alike; false once an unsynced
   * card's remote file has been deleted.
   * @param name - The card's name
   */
  async isFileCardVisible(name: string): Promise<boolean> {
    return this.fileCard(name).isVisible();
  }

  /**
   * Hovers `name`'s unsynced dashboard card and clicks its delete button,
   * opening the "Delete file" confirmation dialog.
   * @param name - The unsynced card's name
   */
  async openFileDeleteDialog(name: string): Promise<void> {
    await this.hoverFile(name);
    await this.fileCard(name).getByLabel("Delete unsynced file").click();
    await expect(this.deleteFileDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads the open "Delete file" dialog's full text (heading + warning
   * body). Requires `openFileDeleteDialog()` to have been called first.
   */
  async getFileDeleteDialogText(): Promise<string> {
    return this.deleteFileDialog.innerText();
  }

  /**
   * Dismisses the open "Delete file" dialog via `method`, without deleting
   * anything.
   * @param method - How to dismiss the dialog
   */
  async dismissFileDeleteDialog(method: DialogDismissMethod): Promise<void> {
    switch (method) {
      case DialogDismissMethod.XButton: {
        await this.deleteFileDialog.locator('[data-icon="x"]').click();
        break;
      }
      case DialogDismissMethod.Escape: {
        await this.page.keyboard.press("Escape");
        break;
      }
      case DialogDismissMethod.ClickOutside: {
        await this.page.mouse.click(5, 5);
        break;
      }
      default: {
        throw new Error(`Unhandled DialogDismissMethod: ${method}`);
      }
    }
    await expect(this.deleteFileDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Confirms the open "Delete file" dialog, permanently archiving the
   * remote file by its backend project id. Requires
   * `openFileDeleteDialog()` to have been called first. The dialog closes
   * immediately (optimistic) — this does not itself wait for the card to
   * disappear or for a failure toast; poll `isFileCardVisible()` or
   * `waitForFileDeleteFailureToast()` afterward.
   */
  async confirmFileDelete(): Promise<void> {
    await this.deleteFileDialog
      .getByRole("button", { name: "Delete unsynced file permanently" })
      .click();
  }

  /**
   * Waits for the "Failed to delete remote file" toast naming `name` to
   * appear, after a `confirmFileDelete()` whose archive call was made to
   * fail.
   * @param name - The unsynced file's name, as named in the toast
   */
  async waitForFileDeleteFailureToast(name: string): Promise<void> {
    await expect(
      this.page.getByText(new RegExp(`Failed to delete ${name}`)),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
