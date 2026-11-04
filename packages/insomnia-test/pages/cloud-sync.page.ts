import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Cloud Sync at the project-dashboard / toolbar level: the sync dropdown
 * (pull, discard) and the entry points to its modals. The modals are
 * `CloudSyncCommitDialogPage`, `CloudSyncHistoryDialogPage` and
 * `CloudSyncBranchesDialogPage`; file deletion is `CloudSyncFileDeletePage`.
 */
export class CloudSyncPage extends BasePage {
  navigate(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // Cloud Sync's sync dropdown reuses the exact same testid/aria-label as
  // Git Sync's (both `sync-dropdown.tsx` and
  // `git-sync-dropdown.tsx` render `data-testid="git-dropdown"`,
  // `aria-label="Git Sync"` — which one mounts depends on whether the
  // active workspace's project is Cloud-synced or has a git repo attached).
  private readonly syncDropdownButton = this.page.getByTestId("git-dropdown");

  private readonly syncMenu = this.page.getByRole("menu", { name: "Git Sync" });
  private readonly commitDialog = this.page.getByRole("dialog", {
    name: "Commit changes",
  });

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
   * Opens the Commit modal via the sync dropdown's "Commit" action.
   */
  async openCommitDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Commit", exact: true })
      .click({ delay: 500 });
    await expect(this.commitDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }






}
