import { ToastComponent } from "@package/components/toast.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Deleting from the project dashboard: a file card's delete button and the
 * "Delete file" dialog, plus the sidebar delete-workspace dialog.
 */
export class CloudSyncFileDeletePage extends BasePage {
  /**
   * Waits for the project dashboard's file grid to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.getByTestId("workspace-grid")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  private readonly deleteFileDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "Delete file" }) });

  /**
   * A project dashboard's own grid card for `name` (a react-aria
   * `GridList` row — the `GridListItem` renders no
   * `data-testid` of its own, only an accessible name from its
   * `textValue`). Scoped to the grid's own `data-testid="workspace-grid"`
   * container — an unfetched fixture's sidebar
   * "unsynced" tree row carries the exact same accessible name and role,
   * so an unscoped `getByRole("row", { name })` hits a strict-mode
   * violation once the sidebar tree is showing that row too.
   */
  private fileCard(name: string) {
    return this.page.getByTestId("workspace-grid").getByRole("row", { name });
  }

  /**
   * Hovers a project dashboard card by its file/collection name.
   */
  async hoverFile(name: string): Promise<void> {
    await this.fileCard(name).hover();
  }

  /**
   * Whether `name`'s dashboard card is currently listed at all — true for
   * a synced/local-only/unsynced card alike; false once an unsynced
   * card's remote file has been deleted.
   */
  async isFileCardVisible(name: string): Promise<boolean> {
    return this.fileCard(name).isVisible();
  }

  /**
   * Hovers `name`'s unsynced dashboard card and clicks its delete button,
   * opening the "Delete file" confirmation dialog.
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
   */
  async waitForFileDeleteFailureToast(name: string): Promise<void> {
    await new ToastComponent(this.page).waitForToast(`Failed to delete ${name}`);
  }
}
