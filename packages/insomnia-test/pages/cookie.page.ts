import { DEFAULT_TIMEOUT } from "@package/misc/constants";

import { BasePage } from "./base.page";

// Short enough that a lost write fails the attempt inside the retry loop's
// own budget, leaving room for another full open-fill-submit cycle.

export class CookiePage extends BasePage {
  private readonly listDialog = this.page.getByRole("dialog", {
    name: "Cookies Modal",
  });

  /**
   * Waits for the "Cookies Modal" dialog to become visible, confirming
   * the cookie list page is ready for interaction.
   */
  async navigate(): Promise<void> {
    await this.listDialog.waitFor({
      state: "visible",
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
