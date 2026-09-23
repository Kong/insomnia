import { expect } from "@playwright/test";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

export class KonnectPage extends BasePage {
  private readonly SIDEBAR_TAB = '[data-testid="sidebar-tab-konnect"]';
  private readonly PROJECTS_TAB = '[data-testid="sidebar-tab-projects"]';

  /**
   * Confirms the Konnect sidebar tab is currently visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.SIDEBAR_TAB)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reports whether the Konnect sidebar tab is currently visible — hidden
   * when the `konnectSync` org feature flag is disabled.
   */
  async isTabVisible(): Promise<boolean> {
    return this.page.locator(this.SIDEBAR_TAB).isVisible();
  }

  /**
   * Clicks the Konnect sidebar tab.
   */
  async openTab(): Promise<void> {
    await this.page.locator(this.SIDEBAR_TAB).click();
  }

  /**
   * Clicks the Projects sidebar tab.
   */
  async openProjectsTab(): Promise<void> {
    await this.page.locator(this.PROJECTS_TAB).click();
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
