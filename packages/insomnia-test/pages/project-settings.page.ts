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
   * Closes the create/update dialog without saving (Escape).
   */
  async closeDialog(): Promise<void> {
    await this.modal.closeWithEscape();
  }

  /**
   * Selects a previously-added credential in the "Authorized as" dropdown
   * of the "Clone from Remote" sub-form, by the credential's display name
   * (e.g. "Custom Git Credential" for a custom/PAT credential).
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
   * Clicks "Choose folder" to pick the clone destination's parent folder.
   * The native folder picker must already be stubbed to return the
   * wanted path (see `FlowContext.stubFileChooser`).
   */
  async chooseCloneLocation(): Promise<void> {
    await this.gitSetupForm
      .getByRole("button", { name: "Choose folder" })
      .click();
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
   * Reads the repository's currently-displayed local path from the "Path to
   * local files" field's `title` attribute.
   */
  async getRepositoryPath(): Promise<string> {
    const title = await this.dialog.locator("span[title]").getAttribute("title");
    return (title ?? "").trim();
  }
}
