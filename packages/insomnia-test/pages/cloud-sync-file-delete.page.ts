import { ToastComponent } from "@package/components/toast.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export enum DialogDismissMethod {
  XButton,
  Escape,
  ClickOutside,
}
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
   * Opens `name`'s workspace-actions dropdown from its sidebar row and
   * clicks "Delete", opening the delete-workspace dialog.
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
      .getByRole("radio", { name: "Delete Permanently" })
      .click();
    await this.page.getByRole("button", { name: "Delete Workspace" }).click();
  }

  /**
   * Hovers a project dashboard card by its file/collection name.
   */
  async hoverFile(name: string): Promise<void> {
    await this.fileCard(name).hover();
  }

  /**
   * Focuses a project dashboard card by its file/collection name —
   * `GridListItem` uses roving tabindex, so this lands focus on the card
   * itself, the same element a real Tab/arrow-key traversal would land
   * on, rather than a descendant.
   */
  async focusFile(name: string): Promise<void> {
    await this.fileCard(name).focus();
  }

  /**
   * Whether `name`'s dashboard card renders a delete ("trash") button at
   * all — it's conditionally rendered only for cards with
   * `scope === 'unsynced' && remoteId`, not merely hidden via CSS, so a
   * synced or local-only card has zero matching elements rather than one
   * with `opacity: 0`. An unsynced card's row itself can render a beat
   * after local ones (its remote-files query resolves asynchronously), so
   * this waits for the row to attach first rather than reading `count()`
   * immediately — a bare immediate read raced that query and produced a
   * false negative on a genuinely-unsynced card.
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
   * revealed. The button always exists in the DOM (see
   * `hasFileDeleteButton()`) but sits at `opacity: 0` until the card is
   * hovered or focused (Tailwind `group-hover`/`group-focus`), animated by
   * a `transition-all` — reading `getComputedStyle` once right after
   * hover/focus can catch it mid-transition, so this polls via
   * `toHaveCSS` instead of a single read. That poll only confirms the
   * button *reached* opacity 1, though — reading right after an action
   * that's expected to hide it again (moving hover elsewhere, blurring)
   * can still catch the outgoing transition's stale "1" before it's had
   * time to animate back down. This polls until the
   * button has no running transition/animation left before taking a
   * single settled reading, rather than polling toward an assumed target
   * value.
   */
  async isFileDeleteButtonRevealed(name: string): Promise<boolean> {
    const button = this.fileCard(name).getByLabel("Delete unsynced file");
    await expect(async () => {
      expect(
        await button.evaluate((el) => el.getAnimations().length),
      ).toBe(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    const opacity = await button.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    return Number(opacity) > 0.5;
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
   * Dismisses the open "Delete file" dialog via `method`, without deleting
   * anything.
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
   */
  async waitForFileDeleteFailureToast(name: string): Promise<void> {
    await new ToastComponent(this.page).waitForToast(`Failed to delete ${name}`);
  }
}
