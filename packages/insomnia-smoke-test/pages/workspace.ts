import type { ElectronApplication, Page } from '@playwright/test';

/**
 * Page Object for the Workspace page (debug view)
 * Handles workspace-level operations including navigation and export
 */
export class WorkspacePage {
  readonly page: Page;
  readonly app?: ElectronApplication;

  constructor(page: Page, app?: ElectronApplication) {
    this.page = page;
    this.app = app;
  }

  /**
   * Navigates back to the project page using the breadcrumb back button
   */
  async goBackToProject() {
    await this.page.getByTestId('project').click();
  }

  /**
   * Waits for the workspace page to be loaded
   */
  async waitForWorkspaceLoaded() {
    // Wait for the breadcrumb to be visible, indicating workspace is loaded
    await this.page.getByTestId('project').waitFor({ state: 'visible' });
  }

  // ==================== Export Operations ====================

  /**
   * Opens the workspace dropdown menu
   */
  async openWorkspaceDropdown() {
    await this.page.getByTestId('workspace-context-dropdown').click();
  }

  /**
   * Clicks the Export option in the workspace dropdown
   */
  async clickExportInWorkspaceDropdown() {
    // Wait for the Export menu item to be visible, then click it
    const exportMenuItem = this.page.getByRole('menuitemradio', { name: 'Export' });
    await exportMenuItem.click();
  }

  /**
   * Clicks the Export button in the Export Requests modal
   */
  async clickExportButtonInExportRequestsModal() {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();
  }

  /**
   * Selects the export format in the format selection modal
   * @param format - The format to select ('yaml' for Insomnia v5, 'har' for HAR)
   */
  async selectExportFormat(format: 'yaml' | 'har') {
    await this.page.getByText('Which format would you like to export as?').waitFor({ state: 'visible' });
    await this.page.getByLabel('Select Modal').locator('select').selectOption(format);
    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  /**
   * Mocks the save dialog to return a specific file path
   * Used for single file exports from workspace dropdown
   * @param filePath - The file path to return
   */
  async mockSaveDialogForFile(filePath: string) {
    if (!this.app) {
      throw new Error('ElectronApplication instance is required for mocking save dialog');
    }
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      ipcMain.removeHandler('showSaveDialog');
      ipcMain.handle('showSaveDialog', async () => {
        return { filePath, canceled: false };
      });
    }, filePath);
  }

  /**
   * Exports the workspace from the workspace dropdown
   * Note: After calling this method, use DataPage.waitForExportFiles() to ensure the file is written
   * @param exportPath - The absolute path where the file should be exported
   * @param format - The export format ('yaml' or 'har')
   */
  async exportWorkspaceFromDropdown(exportPath: string, format: 'yaml' | 'har' = 'yaml') {
    // Mock the save dialog first
    await this.mockSaveDialogForFile(exportPath);

    // Open workspace dropdown
    await this.openWorkspaceDropdown();

    // Click Export option
    await this.clickExportInWorkspaceDropdown();

    // Click Export button in the export requests modal (all requests selected by default)
    await this.clickExportButtonInExportRequestsModal();

    // Select export format
    await this.selectExportFormat(format);
  }
}
