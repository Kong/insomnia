import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";


export class InvitePage extends BasePage {
  private readonly dialog = this.page.getByRole("dialog", {
    name: "Invite collaborators",
  });
  private readonly invitationList = this.dialog.getByLabel("Invitation list");

  /**
   * Waits for the "Invite collaborators" dialog to become visible,
   * confirming it's ready for interaction.
   */
  async navigate(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.invitationList.getByRole("option").first()).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }











}
