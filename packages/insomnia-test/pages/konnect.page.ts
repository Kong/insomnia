import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

export class KonnectPage extends BasePage {
  private readonly PROJECT_TREE =
    '[data-testid="project-navigation-tree-container"]';
  private readonly KONNECT_ORGANIZATION_NAME = "Control Planes";

  /**
   * Confirms the organization switcher — the entry point into the Konnect
   * ("Control Planes") organization — is ready.
   */
  async navigate(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "Organizations" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reports whether the Konnect ("Control Planes") organization is currently
   * offered in the organization switcher — hidden once the account loses its
   * Konnect control-planes entitlement (and has no local Konnect projects
   * left over from a previous version). The option only exists inside the
   * switcher's popover, so this opens it to check and closes it again
   * afterwards to leave the page as it found it.
   */
  async isTabVisible(): Promise<boolean> {
    await this.page.getByRole("button", { name: "Organizations" }).click();
    const isVisible = await this.page
      .getByRole("option", { name: this.KONNECT_ORGANIZATION_NAME })
      .isVisible();
    await this.page.keyboard.press("Escape");
    return isVisible;
  }

  /**
   * Waits for the pre-configuration intro card to render. Resolving the
   * sidebar's intro-card-vs-project-tree choice depends on organization
   * data that loads asynchronously right after switching into the Konnect
   * organization, so this waits on the card itself rather than just the
   * sidebar container — otherwise a caller's next `isIntroCardVisible()`
   * check can race that resolution and see a false negative.
   */
  async openTab(): Promise<void> {
    await expect(
      this.page.getByText("Auto-sync your gateway service routes"),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Waits for the normal project tree to be visible — shown automatically
   * once a Konnect PAT has been saved (the intro card is replaced by it).
   */
  async openProjectsTab(): Promise<void> {
    await expect(this.page.locator(this.PROJECT_TREE)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reports whether the pre-configuration intro card ("Auto-sync your
   * gateway service routes") is currently visible — shown only when no
   * Konnect PAT has been saved yet.
   */
  async isIntroCardVisible(): Promise<boolean> {
    return this.page
      .getByText("Auto-sync your gateway service routes")
      .isVisible();
  }

  /**
   * Clicks the intro card's "Configure" button, opening the Kong Konnect
   * settings modal.
   */
  async clickConfigure(): Promise<void> {
    await this.page.getByRole("button", { name: "Configure" }).click();
  }

  /**
   * Fills the Kong Konnect settings modal's "Personal Access Token" field.
   * Must be called with the modal already open (see `clickConfigure()`).
   * @param pat - The Personal Access Token to enter
   */
  async setPat(pat: string): Promise<void> {
    await this.page.getByLabel("Personal Access Token").fill(pat);
  }

  /**
   * Clicks "Connect & Sync" in the open Kong Konnect settings modal,
   * validating the entered PAT and triggering an initial sync on success,
   * then waits for the modal to close — confirmed live: validating the PAT
   * and fetching the Konnect organization id both happen asynchronously
   * before the modal closes itself, so a caller reading `isSettingsModalOpen()`
   * immediately after this click would still see it open.
   */
  async clickConnectAndSync(): Promise<void> {
    await this.page.getByRole("button", { name: "Connect & Sync" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Kong Konnect settings" }),
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reports whether the Kong Konnect settings modal is currently open.
   */
  async isSettingsModalOpen(): Promise<boolean> {
    return this.page
      .getByRole("heading", { name: "Kong Konnect settings" })
      .isVisible();
  }

  /**
   * Reports whether the sidebar's "Sync Konnect" button is currently
   * visible — shown once a valid PAT has been saved.
   */
  async isSyncButtonVisible(): Promise<boolean> {
    return this.page
      .getByRole("button", { name: "Sync Konnect" })
      .isVisible();
  }
}
