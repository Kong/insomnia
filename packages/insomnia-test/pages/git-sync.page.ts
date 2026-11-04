import { DEFAULT_TIMEOUT } from "@package/misc/constants";

import { BasePage } from "./base.page";

/**
 * The Git Sync dropdown in the workspace toolbar (branch label, fetch /
 * pull / push) and the entry points to its modals. The modals themselves
 * are `GitCommitDialogPage`, `GitBranchesDialogPage` and
 * `GitHistoryDialogPage`.
 */
export class GitSyncPage extends BasePage {
  private readonly syncDropdownButton = this.page.getByTestId("git-dropdown");

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
}
