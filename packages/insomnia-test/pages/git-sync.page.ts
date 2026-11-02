import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

/**
 * The Git Sync dropdown in the workspace toolbar (branch label, fetch /
 * pull / push) and the entry points to its modals. The modals themselves
 * are `GitCommitDialogPage`, `GitBranchesDialogPage` and
 * `GitHistoryDialogPage`.
 */
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
    await this.syncMenu.getByTestId("git-sync-menu-history").click();
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
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

  private async openSyncMenu(): Promise<void> {
    await this.syncDropdownButton.click();
    await expect(this.syncMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
