import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import type { CollaboratorRole } from "../enums/collaborator-role";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

/** A single row read back from the "Invitation list". */
export interface Invitation {
  email: string;
  role: CollaboratorRole;
  status: "Member" | "Invite sent";
}

export class InvitePage extends BasePage {
  private readonly dialog = this.page.getByRole("dialog", {
    name: "Invite collaborators",
  });
  private readonly invitationList = this.dialog.getByLabel("Invitation list");
  /**
   * The invite form's "Organization members" search-results popover is a
   * React Aria `Popover` that portals outside the "Invite collaborators"
   * dialog's own DOM subtree, so it's located from `this.page` directly
   * rather than scoped under `this.dialog`.
   */
  private readonly organizationMembers = this.page.getByLabel(
    "Organization members",
  );
  /**
   * The invite form's email input. Its placeholder switches from "Enter
   * emails, separated by comma..." to "Enter more emails..." once at
   * least one chip has been added, so it's matched by a regex covering
   * both states rather than a fixed placeholder string.
   */
  private readonly emailInput =
    this.dialog.getByPlaceholder(/Enter( more)? emails/);

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

  /**
   * Opens the "Invite collaborators" dialog via the header's
   * "Invite collaborators" button.
   */
  async open(): Promise<void> {
    await this.page
      .getByLabel("Invite collaborators")
      .filter({ visible: true })
      .click();
    await this.navigate();
  }

  /**
   * Types an email into the invite form's input and confirms it as its own
   * chip via Enter — repeat for each address to invite by email rather
   * than by picking an existing organization member.
   * @param email - The email address to add as a pending invitee
   */
  async addEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.emailInput.press("Enter");
  }

  /**
   * Types `query` into the invite form's email input to trigger the
   * "Organization members" search popover, waiting for at least one result
   * to render.
   * @param query - The search text to type
   */
  async searchOrganizationMembers(query: string): Promise<void> {
    await this.emailInput.fill(query);
    await expect(
      this.organizationMembers.getByRole("option").first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the result matching `email` in the currently open "Organization
   * members" search popover, adding it as a pending invitee. Call
   * `searchOrganizationMembers()` first to populate the popover.
   * @param email - The email address of the result to select
   */
  async selectOrganizationMember(email: string): Promise<void> {
    await this.organizationMembers
      .getByRole("option")
      .filter({ hasText: email })
      .click();
  }

  /**
   * Closes the "Organization members" search popover and submits every
   * pending invitee (added via `addEmail()`/`selectOrganizationMember()`)
   * by clicking the dialog's "Invite" button.
   */
  async sendInvites(): Promise<void> {
    await this.page.locator(".app").press("Escape");
    await this.dialog.getByRole("button", { name: "Invite" }).click();
  }

  /**
   * The number of rows currently rendered in the "Invitation list" (both
   * accepted members and pending invites).
   */
  async getInvitationCount(): Promise<number> {
    return this.invitationList.getByRole("option").count();
  }

  /**
   * Reads every row currently rendered in the "Invitation list" into a
   * structured array, one entry per accepted member or pending invite.
   * `status` is "Invite sent" for a still-pending invite (identified by
   * its "Invite sent" badge) and "Member" for an already-accepted one.
   */
  async getInvitations(): Promise<Invitation[]> {
    const rows = this.invitationList.getByRole("option");
    const count = await rows.count();
    const invitations: Invitation[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const email = await row
        .locator("span")
        .filter({ hasText: "@" })
        .first()
        .innerText();
      const pendingBadge = row.getByText("Invite sent");
      const status: Invitation["status"] =
        (await pendingBadge.count()) > 0 ? "Invite sent" : "Member";
      invitations.push({
        email,
        role: await this.getMemberRole(email),
        status,
      });
    }
    return invitations;
  }

  /**
   * The "Invitation list" row whose visible text contains `email`.
   * @param email - The email address to look for
   */
  private invitationRow(email: string): Locator {
    return this.invitationList
      .getByRole("option")
      .filter({ hasText: email })
      .first();
  }

  /**
   * Reports whether `email` currently appears as a row in the
   * "Invitation list".
   * @param email - The email address to look for
   */
  async isInvited(email: string): Promise<boolean> {
    return this.invitationRow(email).isVisible();
  }

  /**
   * Reads the currently selected role shown on `email`'s "Invitation list"
   * row's role-menu trigger.
   * @param email - The email address identifying the row
   */
  async getMemberRole(email: string): Promise<CollaboratorRole> {
    const label = (
      await this.invitationRow(email).getByLabel("Menu").innerText()
    ).trim();
    return label.toLowerCase() as CollaboratorRole;
  }

  /**
   * Opens `email`'s "Invitation list" row's role menu and selects `role`.
   * @param email - The email address identifying the row
   * @param role - The role to select, e.g. `CollaboratorRole.Admin`
   */
  async setMemberRole(email: string, role: CollaboratorRole): Promise<void> {
    await this.invitationRow(email).getByLabel("Menu").click();
    await this.page.getByRole("menuitem", { name: role, exact: true }).click();
  }
}
