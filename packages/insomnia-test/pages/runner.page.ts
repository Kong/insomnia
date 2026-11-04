import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";



export class RunnerPage extends BasePage {
  private readonly REQUEST_PANE = '[data-testid="request-pane"]';


  // `exact` keeps this off the neighbouring "Run Options" dropdown trigger.
  private get runButton(): Locator {
    return this.page
      .locator(this.REQUEST_PANE)
      .getByRole("button", { name: "Run", exact: true });
  }


  /**
   * Waits for the "Run" button to become visible and the request-order
   * list to populate, confirming the Runner pane has fully loaded — the
   * list renders asynchronously slightly after the button itself appears.
   */
  async navigate(): Promise<void> {
    await expect(this.runButton).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    await expect(
      this.page.locator(this.REQUEST_PANE).getByTestId(/^runner-request-list-/).first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }


















}
