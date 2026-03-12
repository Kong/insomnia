import type { ElectronApplication, Locator, Page } from '@playwright/test';

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
  // Navigation
  // ===========================================================================

  /**
   * Opens the settings modal and navigates to the Data tab.
   */
  async openDataTab(): Promise<void> {
    await this.page.getByTestId('settings-button').click();
    await this.page.locator('text=Insomnia Preferences').first().click();
    await this.page.getByRole('tab', { name: 'Data' }).click();
    await this.root.waitFor({ state: 'visible' });
  }

  // ===========================================================================
  // Export Operations
  // ===========================================================================

  /**
   * Clicks the "Export project" button.
   */
  async clickExportProjectButton(): Promise<void> {
    await this.page.getByTestId('export-project-button').click();
  }

  /**
   * Clicks the "Export all data" button.
   */
  async clickExportAllDataButton(): Promise<void> {
    await this.page.getByRole('button', { name: /Export all data/ }).click();
  }

  /**
   * Handles the export type selection modal (Insomnia v5 or HAR).
   * @param format - The format to select ('yaml' for Insomnia v5, 'har' for HAR)
   */
  async selectExportFormat(format: 'yaml' | 'har'): Promise<void> {
    await this.page.getByText('Which format would you like to export as?').waitFor({ state: 'visible' });

    // The modal uses a <select> element, so we need to use selectOption
    await this.page.getByTestId('Select Modal').locator('select').selectOption(format);

    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  /**
   * Waits for the export complete alert modal.
   */
  async waitForExportCompleteAlert(): Promise<void> {
    await this.page.getByText('Export Complete').waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Ok' }).click();
  }

  // ===========================================================================
  // Dialog Mocking
  // ===========================================================================

  /**
   * Mocks the showOpenDialog to return a specific directory path.
   * Used for "Export all data" which uses folder selection.
   * @param dirPath - The directory path to return
   */
  async mockOpenDialogForDirectory(dirPath: string): Promise<void> {
    await this.app.evaluate(async ({ ipcMain }, dirPath) => {
      // Override the showOpenDialog handler to return our temp directory
      ipcMain.removeHandler('showOpenDialog');
      ipcMain.handle('showOpenDialog', async () => {
        return { filePaths: [dirPath], canceled: false };
      });
    }, dirPath);
  }

  /**
   * Mocks the showSaveDialog to return a specific file path.
   * Used for single file exports.
   * @param filePath - The file path to return
   */
  async mockSaveDialogForFile(filePath: string): Promise<void> {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      // Override the showSaveDialog handler to return our temp file path
      ipcMain.removeHandler('showSaveDialog');
      ipcMain.handle('showSaveDialog', async () => {
        return { filePath, canceled: false };
      });
    }, filePath);
  }
}
