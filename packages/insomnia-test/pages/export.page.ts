import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ExportPage extends BasePage {
  private readonly exportRequestsDialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Export requests" });

  private readonly selectExportTypeDialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Select Export Type" });


  /**
   * Confirms either the "Export requests" or "Select Export Type" dialog
   * has appeared, whichever this export scope opens first — a Collection
   * export opens "Export requests" first, while a Project export skips
   * straight to "Select Export Type".
   */
  async navigate(): Promise<void> {
    await expect(
      this.exportRequestsDialog.or(this.selectExportTypeDialog),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }





}
