import type { Locator, Page } from '@playwright/test';

export class ExportModal {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId('global-select-modal');
  }

  /**
   * Handles the export type selection modal (Insomnia v5 or HAR).
   * @param format - The format to select ('yaml' for Insomnia v5, 'har' for HAR)
   */
  async selectExportFormat(format: 'yaml' | 'har'): Promise<void> {
    await this.page.getByText('Which format would you like to export as?').waitFor({ state: 'visible' });

    // The modal uses a <select> element, so we need to use selectOption
    await this.page.getByTestId('global-select-modal').locator('select').selectOption(format);

    await this.page.getByRole('button', { name: 'Done' }).click();
  }
}
