import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { mockOpenDialogForDirectory, mockSaveDialogForFile } from '../../utils';
import { BasePage } from '../base-page';

/**
 * Component for the **Data tab** within Insomnia Preferences.
 *
 * Handles import/export functionality:
 * - Export project files (YAML or HAR)
 * - Export all data
 * - Format selection
 */
export class PreferencesDataTab extends BasePage {
  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    super(page);
  }

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
    await this.exportModal.selectExportFormat(format);
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
   * Waits for the export complete alert modal.
   */
  private async waitForExportCompleteAlert(): Promise<void> {
    await this.page.getByText('Export Complete').waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Ok' }).click();
  }
}
