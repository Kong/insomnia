import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

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
}
