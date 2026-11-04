import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class CertificatesPage extends BasePage {
  /**
   * The "Manage Certificates" overlay is actually two
   * nested `role="dialog"` elements — an inner, named section holding
   * only the header/CA-cert-picker/buttons, and an outer, unnamed one
   * that also contains the (virtualized, non-descendant-queryable)
   * certificate grid. `.filter({ hasText })` + `.first()` latches onto
   * that outer element, matching how every row lookup below needs to see
   * the grid's rendered content.
   */
  private readonly dialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Manage Certificates" })
    .first();

  /**
   * Waits for the "Manage Certificates" dialog to become visible,
   * confirming it's ready for interaction.
   */
  async navigate(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
