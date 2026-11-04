import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class MockServerPage extends BasePage {
  /**
   * Waits for the Mock Server view's route sidebar to be visible.
   */
  async navigate(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "New Mock Route" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
