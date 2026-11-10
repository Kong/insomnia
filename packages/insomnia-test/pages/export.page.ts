import { ModalComponent } from "@package/components/modal.component";
import type { ApiSpecExportFormat } from "@package/enums/api-spec-export-format";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { throwOnDialog } from "@package/misc/decorators";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ExportPage extends BasePage {
  private readonly selectSpecFormatModal = new ModalComponent(
    this.page,
    this.page
      .getByRole("dialog")
      .filter({ hasText: "Select Specification Format" }),
  );

  private readonly selectSpecFormatDialog = this.selectSpecFormatModal.root;

  /** Waits for the "Select Specification Format" modal or any dialog. */
  async navigate(): Promise<void> {
    await expect(this.page.getByRole("dialog").first()).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Handles whatever "Export OpenAPI Spec" opened: if the "Select
   * Specification Format" modal appeared (the workspace had a spec),
   * chooses `format` and clicks "Done", writing the file via the
   * stubbed native save dialog. Otherwise, a "Cannot export" alert must
   * have appeared instead (the spec was empty/missing), so this is a
   * no-op — the alert is left open, and `@throwOnDialog` (below) then
   * rejects with its trimmed text once this method returns.
   */
  @throwOnDialog()
  async exportOpenApiSpec(format: ApiSpecExportFormat): Promise<void> {
    await expect(this.page.getByRole("dialog").first()).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    if (!(await this.selectSpecFormatDialog.isVisible())) return;

    await this.selectSpecFormatDialog
      .getByTestId("select-modal-select")
      .selectOption({ label: format });
    await this.selectSpecFormatModal.clickButton("Done", false);
    await expect(this.selectSpecFormatDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
