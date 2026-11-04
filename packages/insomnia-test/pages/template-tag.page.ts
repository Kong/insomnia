import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class TemplateTagPage extends BasePage {
  private readonly MODAL = '[role="dialog"]';

  /**
   * Waits for the tag-editor modal ("Edit Tag") to become visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.MODAL)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
