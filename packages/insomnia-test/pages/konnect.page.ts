import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class KonnectPage extends BasePage {
  /**
   * Confirms the organization switcher — the entry point into the Konnect
   * ("Control Planes") organization — is ready.
   */
  async navigate(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "Organizations" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
