import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Git Sync dropdown in the workspace toolbar and the entry point to its
 * modals. The Commit modal itself is `GitCommitDialogPage`.
 */
export class GitSyncPage extends BasePage {
  private readonly syncDropdownButton = this.page.getByTestId("git-dropdown");
  private readonly syncMenu = this.page.getByRole("menu", {
    name: "Git Sync",
  });
  private readonly commitModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Commit Changes" }),
  );

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
   * Opens the Commit modal via the Git Sync dropdown's "Commit" action
   * (the item stays disabled until the dropdown's git status reflects an
   * uncommitted change, so the menu is reopened to force a refresh until it
   * enables) and waits for its initial git-status fetch to settle
   * (`data-loading` clears, and at least one change row is listed).
   * Interacting with the modal while it's still loading is unreliable — a
   * background re-render at the wrong moment can silently wipe a
   * just-filled Message field or leave "Stage all changes" acting on an
   * empty list.
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
    await this.commitModal.waitForVisible();
    await expect(this.commitModal.root).not.toHaveAttribute(
      "data-loading",
      "true",
      {
        timeout: DEFAULT_TIMEOUT,
      },
    );
    await expect(
      this.commitModal.root.locator('[role="row"][data-key]').first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  private async openSyncMenu(): Promise<void> {
    await this.syncDropdownButton.click();
    await expect(this.syncMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
