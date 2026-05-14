import type { ElectronApplication, Page } from '@playwright/test';

import { mockSaveDialogForFile } from '../../utils';
import { BasePage } from '../base-page';
import { NavigationSidebar } from '../components/navigation-sidebar';

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
  readonly navigationSidebar: NavigationSidebar;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    super(page);
    this.navigationSidebar = new NavigationSidebar(page);
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
    await this.page.getByTestId('workspace-breadcrumb-level-0').click();
  }

  // ===========================================================================
  // Export Operations
  // ===========================================================================

  /**
   * Exports the workspace from the workspace dropdown.
   * Note: After calling this method, use waitForExportFiles() utility to ensure the file is written.
   * @param exportPath - The absolute path where the file should be exported
   * @param format - The export format ('yaml' or 'har')
   */
  async exportWorkspaceFromDropdown(
    workspaceName: string,
    exportPath: string,
    format: 'yaml' | 'har' = 'yaml',
  ): Promise<void> {
    // Mock the save dialog first
    await mockSaveDialogForFile(this.app, exportPath);

    // Open workspace dropdown and select Export option
    await this.navigationSidebar.selectWorkspaceDropdownOption({
      actionName: 'Export',
      workspaceName,
    });

    // Click Export button in the export requests modal (all requests selected by default)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();

    // Select export format
    await this.exportModal.selectExportFormat(format);
  }
}
