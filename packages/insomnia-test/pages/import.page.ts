import { ModalComponent } from "@package/components/modal.component";
import type { ImportSource } from "@package/enums/import-sources";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class ImportPage extends BasePage {
  // A getter, not a field: see CookiePage.
  private get modal(): ModalComponent {
    return new ModalComponent(this.page);
  }

  private readonly DIALOG = '[role="dialog"]';
  private readonly FILE_INPUT =
    '[role="dialog"] input[data-test-id="import-file-input"]';
  private readonly HEADER = '[role="dialog"] [data-testid="import-modal-header"]';
  private readonly PROJECT_SELECT =
    '[role="dialog"] select[aria-label="Select Project"]';
  private readonly SOURCE_RADIO = (source: ImportSource) =>
    `[role="dialog"] label[data-test-id="import-from-${source}"]`;

  async clickImport(): Promise<void> {
    await this.modal.clickButton("Import", false);
    await expect(this.page.locator(this.DIALOG)).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async clickScan(): Promise<void> {
    await this.modal.clickButton("Scan", false);
    await expect(this.page.locator(this.PROJECT_SELECT)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async navigate(): Promise<void> {
    await expect(this.page.locator(this.HEADER)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async selectProject(name: string): Promise<void> {
    await this.page.locator(this.PROJECT_SELECT).selectOption({ label: name });
  }

  async selectSource(source: ImportSource): Promise<void> {
    await this.page.locator(this.SOURCE_RADIO(source)).click();
  }

  async setFile(filePath: string): Promise<void> {
    await this.page.locator(this.FILE_INPUT).setInputFiles(filePath);
  }
}
