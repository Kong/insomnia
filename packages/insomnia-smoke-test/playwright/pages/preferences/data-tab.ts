import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { mockOpenDialogForDirectory, mockSaveDialogForFile } from '../../utils';

/**
 * Component for the **Data tab** within Insomnia Preferences.
 *
 * Handles import/export functionality:
 * - Export project files (YAML or HAR)
 * - Export all data
 * - Format selection
 */
export class PreferencesDataTab {
  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {}

  get root(): Locator {
    return this.page.getByTestId('import-export-tab');
  }

  // ===========================================================================
  // Export Operations
  // ===========================================================================

  /**
   * Clicks the "Export project" button.
   */
  async exportProjectData(dirPath: string, format: 'yaml' | 'har'): Promise<void> {
    await this.page.getByTestId('export-project-button').click();
    if (format === 'yaml') {
      await mockOpenDialogForDirectory(this.app, dirPath);
    } else if (format === 'har') {
      await mockSaveDialogForFile(this.app, dirPath);
    }
    await this.selectExportFormat(format);
  }

  /**
   * Clicks the "Export all data" button.
   */
  async exportAllData(dirPath: string): Promise<void> {
    await mockOpenDialogForDirectory(this.app, dirPath);
    await this.page.getByRole('button', { name: /Export all data/ }).click();

    await this.waitForExportCompleteAlert();
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

  /**
   * Waits for the export complete alert modal.
   */
  async waitForExportCompleteAlert(): Promise<void> {
    await this.page.getByText('Export Complete').waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Ok' }).click();
  }
}
