import { expect } from "@playwright/test";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { ExportFormat } from "../enums/export-format";
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

  /**
   * Confirms the request-selection step of a Collection export, keeping
   * every request checked (its "All requests" checkbox starts checked),
   * and advances to "Select Export Type". Only appears for a
   * Collection-scoped export — a no-op for Project/all-data exports,
   * which never show this dialog.
   */
  async confirmRequestSelection(): Promise<void> {
    if (!(await this.exportRequestsDialog.isVisible())) return;
    await this.exportRequestsDialog
      .getByRole("button", { name: "Export", exact: true })
      .click();
    await expect(this.selectExportTypeDialog).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Chooses the export file format on the "Select Export Type" dialog.
   * @param format - The format to export as
   */
  async selectFormat(format: ExportFormat): Promise<void> {
    await this.selectExportTypeDialog
      .locator("select")
      .selectOption({ label: format });
  }

  /**
   * Clicks "Done" on the "Select Export Type" dialog, which writes the
   * file via the stubbed native save/open dialog.
   */
  async confirmFormat(): Promise<void> {
    await this.selectExportTypeDialog
      .getByRole("button", { name: "Done" })
      .click();
    await expect(this.selectExportTypeDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Dismisses the "Export Complete" confirmation dialog if one appears —
   * only shown for a multi-file (Project/all-data) export, and even then
   * not consistently, so this polls briefly rather than requiring it.
   */
  async dismissCompletionIfShown(): Promise<void> {
    const completeDialog = this.page
      .getByRole("dialog")
      .filter({ hasText: "Export Complete" });
    if (
      await completeDialog
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await completeDialog.getByRole("button", { name: "Ok" }).click();
    }
  }

  /**
   * Stubs the native save-file dialog so a single-file (Collection)
   * export writes to `filePath` instead of prompting.
   * @param filePath - Absolute path the export should be written to
   */
  async stubSaveFileLocation(filePath: string): Promise<void> {
    await this.stubSaveDialog(filePath);
  }

  /**
   * Stubs the native folder-picker dialog so a multi-file (Project/
   * all-data) export writes into `directoryPath` instead of prompting.
   * @param directoryPath - Absolute directory path the export should be written into
   */
  async stubSaveDirectoryLocation(directoryPath: string): Promise<void> {
    await this.stubFileChooser(directoryPath);
  }
}
