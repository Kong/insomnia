import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ImportPage extends BasePage {
  // Formerly "Select Collection".
  private readonly HEADER = '[role="dialog"] [data-testid="import-modal-header"]';



  async navigate(): Promise<void> {
    await expect(this.page.locator(this.HEADER)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }








}
