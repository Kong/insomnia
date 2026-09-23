import { expect, Locator } from "@playwright/test";
import { BasePage } from "./base.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { ProjectType } from "../enums/project-types";

export class ProjectSettingsPage extends BasePage {
  private readonly dialog = this.page.getByRole("dialog", {
    name: "Create or update dialog",
  });
  private readonly relocateButton = this.dialog.getByRole("button", {
    name: "Move repository to another folder",
  });
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
  /** The "Open" confirm button in the "Open local folder" sub-form — polled via `isDisabled()`. */
  private readonly openFolderConfirmButton = this.dialog.getByRole("button", {
    name: "Open",
    exact: true,
  });
  private readonly trustFolderDialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Do you trust this folder?" });

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
   * Fills the "Project name" field in the create/update dialog.
   * @param name - The new project name
   */
  async setName(name: string): Promise<void> {
    await this.nameField.fill(name);
  }

  /**
   * Clicks "Update" to save the project name change. Closes the dialog
   * as a side effect — don't call `close()` afterward.
   */
  async clickUpdate(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Update" }).click();
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * The project-type tile's radio control in the create/update-project
   * dialog (e.g. Git blocked by org storage rule). Poll via `isDisabled()`.
   * @param type - The project type tile to locate
   */
  projectTypeTile(type: ProjectType): Locator {
    return this.page.getByLabel(`Project Type: ${type}`, { exact: true });
  }

  /**
   * Reads the visible text of a labeled banner in the create/update-project
   * dialog (e.g. "Git Sync Feature Disabled Banner", "Project Storage
   * Restriction Banner").
   * @param label - The banner's accessible label
   * @returns The banner's trimmed text, or undefined if it isn't visible
   */
  async getBannerText(label: string): Promise<string | undefined> {
    const banner = this.page.getByLabel(label);
    if (!(await banner.isVisible())) return undefined;
    return (await banner.innerText()).trim();
  }

  /**
   * Selects a previously-added credential in the "Authorized as" dropdown
   * of the "Clone from Remote" sub-form, by the credential's display name
   * (e.g. "Custom Git Credential" for a custom/PAT credential).
   * @param name - The credential's display name
   */
  async selectCredential(name: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("button", { name: /Authorized as/ })
      .click();
    await this.page.getByRole("option", { name, exact: true }).click();
  }

  /**
   * Fills the Repository URL field in the "Clone from Remote" sub-form.
   * @param url - The remote repo URL, e.g. "http://localhost:4070/demo.git"
   */
  async setRepositoryUrl(url: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("textbox", { name: "Repository URL" })
      .fill(url);
  }

  /**
   * Selects a remote branch to clone from the branch dropdown.
   * @param branch - The branch name to select, e.g. "master"
   */
  async selectBranch(branch: string): Promise<void> {
    await this.gitSetupForm
      .getByRole("button", { name: "Show suggestions Branch" })
      .click();
    await this.page.getByRole("option", { name: branch, exact: true }).click();
  }

  /**
   * Picks the clone destination's parent folder via the native folder
   * picker, stubbed to return `folderPath` immediately.
   * @param folderPath - The absolute path to clone into (as a parent dir)
   */
  async chooseCloneLocation(folderPath: string): Promise<void> {
    await this.stubFileChooser(folderPath);
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
   * Picks the folder to adopt via the native folder picker, stubbed to
   * return `folderPath` immediately. Requires `selectGitOpenMode()` to
   * have been called first.
   * @param folderPath - The absolute path of the folder to open as a Git project
   */
  async chooseOpenFolderLocation(folderPath: string): Promise<void> {
    await this.stubFileChooser(folderPath);
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
    await this.trustFolderDialog
      .getByRole("button", { name: "Open folder" })
      .click();
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the inline "already connected to this folder" collision warning
   * shown after picking a folder that's already adopted by another
   * project. Requires `chooseOpenFolderLocation()` to have been called
   * first.
   * @returns The trimmed warning text, or undefined if no warning is showing
   */
  async getOpenFolderCollisionError(): Promise<string | undefined> {
    const warning = this.dialog.getByText(/is already connected to this folder/i);
    if (!(await warning.isVisible())) return undefined;
    return (await warning.innerText()).trim();
  }

  /**
   * Reads the repository's currently-displayed local path from the "Path to
   * local files" field's `title` attribute.
   * @returns The trimmed absolute path
   */
  async getRepositoryPath(): Promise<string> {
    const title = await this.dialog.locator("span[title]").getAttribute("title");
    return (title ?? "").trim();
  }

  /**
   * Stubs the native folder picker to return `destinationDir`, then clicks
   * "Move repository to another folder" to relocate the repo directly into
   * `destinationDir` (the picked folder itself becomes the new repository
   * path — no nested repo-name subfolder is created). Does not wait for
   * the result — the new path (or a collision error) settles
   * asynchronously; read it back via
   * `getRepositoryPath()`/`getRelocationError()`.
   * @param destinationDir - The folder to move the repo into
   */
  async relocateRepository(destinationDir: string): Promise<void> {
    await this.stubFileChooser(destinationDir);
    await this.relocateButton.click();
  }

  /**
   * Reads the inline relocation-error banner's text, if visible (e.g. a
   * destination-already-has-files collision).
   * @returns The trimmed error text, or undefined if no error is showing
   */
  async getRelocationError(): Promise<string | undefined> {
    const error = this.dialog.getByText(
      /already has files in it and isn't a git repository/i,
    );
    if (!(await error.isVisible())) return undefined;
    return (await error.innerText()).trim();
  }

}
