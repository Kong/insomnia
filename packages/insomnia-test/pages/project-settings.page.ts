import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ProjectSettingsPage extends BasePage {
  private readonly modal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Create or update dialog" }),
  );
  private readonly dialog = this.modal.root;

  private readonly nameField = this.dialog.getByRole("textbox", {
    name: "Project name",
  });
  /** The "Clone from Remote" sub-form — polled via `isHidden()`. */
  readonly gitSetupForm = this.dialog.getByRole("form", {
    name: "Git Setup Form",
  });
  /** The "Scan for files" button — polled via `isDisabled()`. */
  readonly scanForFilesButton = this.dialog.getByRole("button", {
    name: "Scan for files",
    exact: true,
  });
  private readonly openLocalFolderModeButton = this.dialog.getByRole(
    "button",
    { name: "Open local folder" },
  );
  private readonly chooseOpenFolderButton = this.dialog.getByRole("button", {
    name: "Choose folder",
  });
  private readonly openFolderConfirmButton = this.dialog.getByRole("button", {
    name: "Open",
    exact: true,
  });
  private readonly trustFolderModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog").filter({ hasText: "Do you trust this folder?" }),
  );
  private readonly trustFolderDialog = this.trustFolderModal.root;

  /**
   * Waits for the Project Settings form's "Project name" field to become
   * visible, confirming the create/update dialog has loaded — for any
   * project type, not just Git Sync (whose settings additionally show a
   * "Move repository to another folder" button).
   */
  async navigate(): Promise<void> {
    await expect(this.nameField).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Selects a previously-added credential in the "Authorized as" dropdown
   * of the "Clone from Remote" sub-form, by the credential's display name.
   */
  async selectCredential(name: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("button", { name: /Authorized as/ })
      .click();
    await this.page.getByRole("option", { name, exact: true }).click();
  }

  /**
   * Fills the Repository URL field in the "Clone from Remote" sub-form.
   */
  async setRepositoryUrl(url: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("textbox", { name: "Repository URL" })
      .fill(url);
  }

  /**
   * Selects a remote branch to clone from the branch dropdown.
   */
  async selectBranch(branch: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("button", { name: "Show suggestions Branch" })
      .click();
    await this.page.getByRole("option", { name: branch, exact: true }).click();
  }

  /**
   * Submits the "Clone from Remote" sub-form, triggering a scan of the
   * remote repo's files before the final clone/create confirmation.
   */
  async submitScanForFiles(): Promise<void> {
    await this.scanForFilesButton.click();
    // The dialog flips to the results view before the scan request has started, and in that
    // window it already shows the empty-result state ("Create Blank Project", no warning).
    // Wait for the in-flight indicator so a later read can't mistake that for a finished scan.
    // A scan so fast it never paints this is fine to skip: it has finished already.
    await this.dialog
      .getByText("Scanning remote repo for Insomnia files")
      .waitFor({ state: "visible", timeout: 3000 })
      .catch(() => {});
  }

  /**
   * Confirms the clone on the post-scan results view. The button's
   * accessible name depends on what the scan found (an existing Insomnia
   * export, an empty repo, or neither).
   */
  async confirmClone(): Promise<void> {
    await this.dialog
      .getByRole("button", {
        name: /^(Clone Project|Clone and Migrate|Create Blank Project|Create)$/,
      })
      .click();
    // The dialog only closes once the clone (git fetch + project creation) finishes.
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Switches the Git project sub-form from its default "Clone from Remote"
   * mode into "Open local folder" mode, which adopts an existing local
   * folder as the project's git repo (running `git init` inside it if it
   * isn't already one) instead of cloning from a URL.
   */
  async selectGitOpenMode(): Promise<void> {
    await this.openLocalFolderModeButton.click();
    await expect(this.chooseOpenFolderButton).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks "Choose folder" to pick the folder to adopt. The native folder
   * picker must already be stubbed to return the wanted path (see
   * `FlowContext.stubFileChooser`). Requires `selectGitOpenMode()` to have
   * been called first.
   */
  async chooseOpenFolderLocation(): Promise<void> {
    await this.chooseOpenFolderButton.click();
  }

  /**
   * Clicks "Open" to confirm adopting the folder picked via
   * `chooseOpenFolderLocation()`, then confirms the one-time "Do you trust
   * this folder?" prompt via its "Open folder" button.
   * @throws If "Open" stays disabled — the picked folder is already
   * connected to another project (see `getOpenFolderCollisionError()`).
   * "Open" is briefly disabled while the app validates the picked folder
   * against existing projects even in the non-collision case, so this
   * gives it a short grace period to become enabled before concluding
   * it's a genuine collision — rather than clicking straight away, which
   * would otherwise sit retrying actionability for the full
   * `DEFAULT_TIMEOUT` on a disabled button before failing.
   */
  async confirmOpenFolder(): Promise<void> {
    try {
      await expect(this.openFolderConfirmButton).toBeEnabled({
        timeout: 2000,
      });
    } catch {
      throw new Error(
        'confirmOpenFolder(): "Open" is disabled — the picked folder is already connected to another project',
      );
    }
    await this.openFolderConfirmButton.click({timeout: DEFAULT_TIMEOUT});
    await expect(this.trustFolderDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    await this.trustFolderModal.clickButton("Open folder", false);
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }
}
