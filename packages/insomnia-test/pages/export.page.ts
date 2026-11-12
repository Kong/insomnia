import { ModalComponent } from "@package/components/modal.component";
import type { ExportFormat } from "@package/enums/export-format";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ExportPage extends BasePage {
  // Getters, not fields: see CookiePage.
  private get exportRequestsModal(): ModalComponent {
    return new ModalComponent(
      this.page,
      this.page.getByRole("dialog").filter({ hasText: "Export requests" }),
    );
  }

  private get selectExportTypeModal(): ModalComponent {
    return new ModalComponent(
      this.page,
      this.page.getByRole("dialog").filter({ hasText: "Select Export Type" }),
    );
  }

  private get exportRequestsDialog(): Locator {
    return this.exportRequestsModal.root;
  }

  private get selectExportTypeDialog(): Locator {
    return this.selectExportTypeModal.root;
  }

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

  /**
   * Confirms the request-selection step of a Collection export, keeping
   * every request checked (its "All requests" checkbox starts checked),
   * and advances to "Select Export Type". Only appears for a
   * Collection-scoped export — a no-op for Project/all-data exports,
   * which never show this dialog.
   */
  async confirmRequestSelection(): Promise<void> {
    if (!(await this.exportRequestsDialog.isVisible())) return;
    await this.exportRequestsModal.clickButton("Export");
    await expect(this.selectExportTypeDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Chooses the export file format on the "Select Export Type" dialog.
   */
  async selectFormat(format: ExportFormat): Promise<void> {
    await this.selectExportTypeDialog
      .getByTestId("select-modal-select")
      .selectOption({ label: format });
  }

  /**
   * Clicks "Done" on the "Select Export Type" dialog, which writes the
   * file via the stubbed native save/open dialog.
   */
  async confirmFormat(): Promise<void> {
    await this.selectExportTypeModal.clickButton("Done", false);
    await expect(this.selectExportTypeDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
