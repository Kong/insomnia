import { expect } from "@playwright/test";

import { ProjectType } from "../enums/project-types";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

export const NEW_PROJECT_BUTTON = 'button[aria-label="Create new Project"]';

/**
 * Project/organization level UI: the "Create new Project" flow, the
 * organization switcher, and the login/Scratch Pad entry points.
 */
export class ProjectPage extends BasePage {
  private readonly NEW_PROJECT_DIALOG =
    "[aria-label='Create or update dialog']";

  /**
   * Waits for the "Create new Project" button to be visible, confirming
   * the workspace/projects screen has loaded.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(NEW_PROJECT_BUTTON)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks the "Create new Project" button and waits for the
   * create/update dialog to appear.
   */
  async clickNewProject(): Promise<void> {
    await this.page.locator(NEW_PROJECT_BUTTON).click();
    await expect(this.page.locator(this.NEW_PROJECT_DIALOG)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Logs out via the header's user-dropdown menu ("Log out" -> confirm
   * "Log Out" in the modal), then waits for the login screen's "Use local
   * Scratch Pad" entry point to appear. Works even against a session
   * injected directly via `INSOMNIA_SESSION` (not a real backend login) —
   * `logout()` only clears local session state.
   */
  async logOut(): Promise<void> {
    await this.page
      .getByTestId("user-dropdown")
      .filter({ visible: true })
      .click();
    await this.page.getByTestId("account-logout").click();
    await this.page.getByRole("button", { name: "Log Out" }).click();
    await expect(this.page.getByLabel("Use local Scratch Pad")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks the login screen's "Use local Scratch Pad" entry point and
   * waits for the Scratch Pad workspace to load. Must be called after
   * `logOut()`.
   */
  async clickUseLocalScratchPad(): Promise<void> {
    await this.page.getByLabel("Use local Scratch Pad").click();
    await expect(
      this.page.getByRole("heading", { name: "Unlock full features" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reports whether a login-screen entry point (e.g. `"Continue with
   * Email"`, `"Use local Scratch Pad"`) is currently visible. Must be
   * called after `logOut()`.
   */
  async isLoginEntryPointVisible(name: string): Promise<boolean> {
    return this.page.getByLabel(name).isVisible();
  }

  /**
   * Reports whether the Scratch Pad workspace's "Unlock full features"
   * sign-up nudge is currently visible. Must be called after
   * `clickUseLocalScratchPad()`.
   */
  async isUnlockFullFeaturesVisible(): Promise<boolean> {
    return this.page
      .getByRole("heading", { name: "Unlock full features" })
      .isVisible();
  }

  /**
   * Opens the organization switcher and selects the organization with the
   * given name (e.g. "Control Planes" for the Konnect organization).
   */
  async switchOrganization(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Organizations" }).click();
    await this.page.getByRole("option", { name }).click();
  }

  /**
   * Selects a project type in the create-project dialog. For Local and
   * Cloud projects, waits for the Create button to become enabled. For Git
   * projects, the Create button is replaced by a multi-step repo-detail
   * sub-form (credential setup, repo URL, branch, clone location), so this
   * instead waits for that sub-form's initial surface to appear — either
   * the "Setup Git Credentials" card (no credential configured yet) or the
   * "Git Setup Form" (a credential already exists) — leaving the rest of
   * the form to GitSyncPage/GitSyncFlow.
   */
  async setNewProjectType(type: ProjectType): Promise<void> {
    await this.page
      .locator(`div[aria-label="Project Type Item: ${type}"]`)
      .click();
    if (type === ProjectType.Git) {
      await expect(
        this.page
          .getByText("Setup Git Credentials")
          .or(this.page.getByRole("form", { name: "Git Setup Form" })),
      ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      return;
    }
    await expect(
      this.page.getByRole("button", { name: "Create", exact: true }),
    ).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks a project-type tile in the create/update-project dialog without
   * waiting for a successful sub-form to appear afterward, unlike
   * `setNewProjectType()`. Needed when the type is expected to be blocked
   * (Git Sync disabled via feature flag), where that success wait would
   * never resolve.
   */
  async clickProjectTypeTile(type: ProjectType): Promise<void> {
    await this.page
      .locator(`div[aria-label="Project Type Item: ${type}"]`)
      .click();
  }
}
