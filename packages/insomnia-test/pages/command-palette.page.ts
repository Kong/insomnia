import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class CommandPalettePage extends BasePage {
  private readonly DIALOG = '[aria-label="Command palette dialog"]';
  // The results listbox is a Popover portaled outside the dialog's own DOM
  // subtree, so it can't be scoped under DIALOG.



  /**
   * Waits for the command palette dialog to become visible, confirming
   * it has been opened.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.DIALOG)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }




}
