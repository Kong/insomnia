import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ProjectSettingsPage extends BasePage {
  private readonly dialog = this.page.getByRole("dialog", {
    name: "Create or update dialog",
  });
  private readonly nameField = this.dialog.getByRole("textbox", {
    name: "Project name",
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
}
