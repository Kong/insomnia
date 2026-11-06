import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";
import { SyncStatus } from "@package/enums/sync-status";
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
  private readonly commitModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Commit changes" }),
  );
  private readonly branchesModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Branches" }),
  );
  private readonly historyModal = ModalComponent.byTitle(this.page, "History");

  /**
   * Waits for the project dashboard's file/collection grid to finish its
   * async remote-files query and render at least one card — confirmed
   * live: right after navigating in, `data-testid="workspace-grid"`
   * exists but is still empty for a beat, so reading `hasFileDeleteButton()`
   * immediately after navigating can race a still-loading grid.
   */
  async waitForDashboardLoaded(): Promise<void> {
    await expect(
      new TableComponent(this.page, this.page.getByTestId("workspace-grid")).rows.first(),
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
    // Fetching already navigates into the workspace, and the sidebar then
    // auto-expands it asynchronously. Do NOT click the row here: once the
    // route is on this workspace a click is a collapse/expand toggle, so it
    // can land after the auto-expand and fold the row back to collapsed.
    // Just wait for the auto-expand to settle (non-collection rows have no
    // `data-expanded` attribute, so they pass immediately).
    await expect(workspaceRow).not.toHaveAttribute("data-expanded", "false", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Re-clicks a workspace's own sidebar row, without going through the
   * "unsynced" fetch path — used to re-trigger the workspace route's own
   * data loader (e.g. right before simulating a main-window focus change,
   * so the background "check for remote changes" logic has fresh route
   * data to act on).
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
   * resolves. Two gotchas, both required to reliably observe
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
    await this.commitModal.waitForVisible();
  }

  /**
   * Reads whether the sync dropdown's "Commit" action is currently
   * disabled (no staged/unstaged changes left) — opens the menu to check,
   * then closes it again.
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
    await this.historyModal.waitForVisible();
  }

  /**
   * Opens the Branches modal via the sync dropdown's "Branches" action.
   */
  async openBranchesDialog(): Promise<void> {
    await this.openSyncMenu();
    await this.syncMenu
      .getByRole("menuitemradio", { name: "Branches", exact: true })
      .click();
    await this.branchesModal.waitForVisible();
  }

  /**
   * Opens the sync dropdown and waits for its "Pull" action to become
   * enabled (reflecting a detected remote commit), then reads back its
   * current label — plain "Pull" when there's nothing to pull, or
   * "Pull N Commit(s)" once one is detected. Leaves the menu open;
   * call `closeSyncMenu()` afterward.
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
}
