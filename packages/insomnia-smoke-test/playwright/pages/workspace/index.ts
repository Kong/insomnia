import type { ElectronApplication, Page } from '@playwright/test';

import { mockSaveDialogForFile } from '../../utils';
import { BasePage } from '../base-page';

/**
 * Page Object for the **workspace page** (debug view).
 *
 * Visible at route: `/organization/:orgId/project/:projectId/workspace/:workspaceId`
 *
 * Handles workspace-level operations:
 * - Navigation (breadcrumb navigation)
 * - Export operations (from workspace dropdown)
 */
export class WorkspacePage extends BasePage {
  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    super(page);
  }

  /** The root workspace container. */
  get root() {
    // Use the breadcrumb as a reliable indicator that workspace is loaded
    return this.page.getByTestId('workspace-page');
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  /**
   * Navigates back to the project page using the breadcrumb back button.
   */
  async goBackToProject(): Promise<void> {
    await this.page.getByTestId('project').click();
  }

  // ===========================================================================
  // Export Operations
  // ===========================================================================

  /**
   * Opens the workspace dropdown menu.
   */
  private async openWorkspaceDropdown(): Promise<void> {
    await this.page.getByTestId('workspace-context-dropdown').click();
  }

  /**
   * Exports the workspace from the workspace dropdown.
   * Note: After calling this method, use waitForExportFiles() utility to ensure the file is written.
   * @param exportPath - The absolute path where the file should be exported
   * @param format - The export format ('yaml' or 'har')
   */
  async exportWorkspaceFromDropdown(exportPath: string, format: 'yaml' | 'har' = 'yaml'): Promise<void> {
    // Mock the save dialog first
    await mockSaveDialogForFile(this.app, exportPath);

    // Open workspace dropdown
    await this.openWorkspaceDropdown();

    // Click Export option
    const exportMenuItem = this.page.getByRole('menuitemradio', { name: 'Export' });
    await exportMenuItem.click();

    // Click Export button in the export requests modal (all requests selected by default)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();

    // Select export format
    await this.exportModal.selectExportFormat(format);
  }
}
