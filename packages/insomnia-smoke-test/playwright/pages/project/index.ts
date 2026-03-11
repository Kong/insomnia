import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { loadFixture } from '../../paths';
import { WorkspaceListComponent } from './workspace-list';

export type ProjectStorageType = 'local' | 'remote' | 'git';

/**
 * Page Object for the **project page** (file list view).
 *
 * Visible at route: `/organization/:orgId/project/:projectId`
 *
 * Composes shared layout components and project-specific components:
 * - TopNavBar, Statusbar, NavBar, TabBar (layout)
 * - Sidebar, Toolbar, WorkspaceList (project-specific)
 */
export class ProjectPage {
  /** The workspace list (files). */
  readonly workspaceList: WorkspaceListComponent;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    this.workspaceList = new WorkspaceListComponent(page);
  }

  /** The root app container. */
  get root() {
    return this.page.locator('.app');
  }

  // ===========================================================================
  // Project Creation
  // ===========================================================================

  /**
   * Opens the create project modal.
   */
  async openCreateProjectModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create new Project' }).click();
  }

  /**
   * Sets the project name in the create/edit modal.
   * @param name - The project name
   */
  async setProjectName(name: string): Promise<void> {
    const input = this.page.getByPlaceholder('My Project');
    await input.click();
    await input.fill(name);
  }

  /**
   * Selects the storage type for the project.
   * @param storageType - The storage type: 'local' (Local Vault), 'remote' (Cloud Sync), or 'git' (Git Sync)
   */
  async selectStorageType(storageType: ProjectStorageType): Promise<void> {
    await this.page.getByText(this.getStorageTypeName(storageType)).click();
  }

  /**
   * Gets the display name for a storage type.
   */
  private getStorageTypeName(storageType: ProjectStorageType): string {
    const typeNames: Record<ProjectStorageType, string> = {
      local: 'Local Vault',
      remote: 'Cloud Sync',
      git: 'Git Sync',
    };
    return typeNames[storageType];
  }

  /**
   * Clicks the Create button in the modal.
   */
  async clickCreateButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  /**
   * Creates a new project with the specified name and storage type.
   * @param name - The project name (defaults to 'My Project')
   * @param storageType - The storage type (defaults to 'local')
   */
  async createProject(name = 'My Project', storageType: ProjectStorageType = 'local'): Promise<void> {
    await this.openCreateProjectModal();
    if (name !== 'My Project') {
      await this.setProjectName(name);
    }
    await this.selectStorageType(storageType);
    await this.clickCreateButton();
  }

  /**
   * Selects a project from the sidebar by name.
   * @param projectName - The name of the project to select
   */
  async selectProject(projectName: string): Promise<void> {
    await this.page.getByRole('row', { name: projectName }).first().click();
  }

  // ===========================================================================
  // Import Operations
  // ===========================================================================

  /**
   * Import a fixture file from clipboard.
   * This is the most common operation in tests.
   */
  async importFixture(fixturePath: string): Promise<void> {
    const text = await loadFixture(fixturePath);
    await this.app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await this.root.getByLabel('Import').click();
    await this.page.locator('[data-test-id="import-from-clipboard"]').click();
    await this.page.getByRole('button', { name: 'Scan' }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  }

  /**
   * Opens the import modal from the empty project view.
   * Use this when the project has no workspaces.
   */
  async openImportModalFromEmptyProject(): Promise<void> {
    await this.page.getByRole('button', { name: 'Import', exact: true }).click();
  }

  /**
   * Opens the import modal from the toolbar.
   * Use this when the project already has workspaces.
   */
  async openImportModalFromToolbar(): Promise<void> {
    await this.page.getByLabel('Import').click();
  }

  /**
   * Selects the import source type in the import modal.
   * @param source - The import source: 'file', 'uri', 'curl', or 'clipboard'
   */
  async selectImportSource(source: 'file' | 'uri' | 'curl' | 'clipboard'): Promise<void> {
    await this.page.locator(`[data-test-id="import-from-${source}"]`).click();
  }

  /**
   * Mocks the file dialog to return the specified file path.
   * This is required because Electron's file dialog cannot be automated directly.
   * @param filePath - The absolute path to the file to import
   */
  async mockFileDialog(filePath: string): Promise<void> {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      ipcMain.removeHandler('showOpenDialog');
      ipcMain.handle('showOpenDialog', async () => {
        return { filePaths: [filePath], canceled: false };
      });
    }, filePath);
  }

  /**
   * Clicks the Scan button in the import modal.
   */
  async clickScanButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Scan' }).click();
  }

  /**
   * Clicks the Import button in the import modal (after scanning).
   */
  async clickImportButton(): Promise<void> {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  }

  /**
   * Waits for the import to complete by checking for workspace cards or navigation.
   */
  async waitForImportComplete(): Promise<void> {
    // Wait for the modal to close (import redirects or closes modal)
    await this.page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10_000 });
  }

  /**
   * Imports multiple fixture files into the project via clipboard.
   * After each import, navigates back to the project page to continue importing.
   * @param fixturePaths - Array of paths relative to fixtures directory
   */
  async importMultipleFixtures(fixturePaths: string[]): Promise<void> {
    let isFirstImport = true;

    for (const fixturePath of fixturePaths) {
      const content = await loadFixture(fixturePath);
      if (isFirstImport) {
        // First import - check if project is empty
        const isEmpty = await this.isProjectEmpty();
        isEmpty ? await this.importFromClipboardEmptyProject(content) : await this.importFromClipboardToolbar(content);
        isFirstImport = false;
      } else {
        // Subsequent imports - project will have workspaces
        await this.importFromClipboardToolbar(content);
      }

      // After import, app redirects to workspace page
      // Navigate back to project page for next import or to continue testing
      await this.page.getByTestId('project').waitFor({ state: 'visible' });
      await this.page.getByTestId('project').click();
    }
  }

  /**
   * Imports content from clipboard into the project from an empty project state.
   * @param content - The content to import (will be written to clipboard)
   */
  private async importFromClipboardEmptyProject(content: string): Promise<void> {
    await this.app.evaluate(async ({ clipboard }, content) => clipboard.writeText(content), content);
    await this.openImportModalFromEmptyProject();
    await this.selectImportSource('clipboard');
    await this.clickScanButton();
    await this.clickImportButton();
    await this.waitForImportComplete();
  }

  /**
   * Imports content from clipboard into the project when workspaces already exist.
   * @param content - The content to import (will be written to clipboard)
   */
  private async importFromClipboardToolbar(content: string): Promise<void> {
    await this.app.evaluate(async ({ clipboard }, content) => clipboard.writeText(content), content);
    await this.openImportModalFromToolbar();
    await this.selectImportSource('clipboard');
    await this.clickScanButton();
    await this.clickImportButton();
    await this.waitForImportComplete();
  }

  // ===========================================================================
  // Workspace Verification
  // ===========================================================================

  /**
   * Verifies that a workspace (collection/document) exists in the project.
   * @param workspaceName - The name of the workspace to check
   * @returns true if the workspace exists
   */
  async hasWorkspace(workspaceName: string): Promise<boolean> {
    const workspace = this.page.getByLabel(workspaceName);
    return workspace.isVisible();
  }

  /**
   * Gets the workspace card locator for a given workspace name.
   * @param workspaceName - The name of the workspace
   */
  workspaceCardLocator(workspaceName: string): Locator {
    return this.page.getByLabel('Files').getByLabel(workspaceName);
  }

  /**
   * Waits for the project empty view to be visible.
   */
  async waitForEmptyProjectView(): Promise<void> {
    await this.page.getByText('Welcome to your project!').waitFor({ state: 'visible' });
  }

  /**
   * Checks if the project is empty (no workspaces).
   */
  async isProjectEmpty(): Promise<boolean> {
    return this.page.getByText('Welcome to your project!').isVisible();
  }

  /**
   * Gets the count of all files in the current project.
   */
  async getFilesCount(): Promise<number> {
    const allFilesText = await this.page.getByLabel(/All Files \(\d+\)/).textContent();
    const match = allFilesText?.match(/All Files \((\d+)\)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  // ===========================================================================
  // Export (from workspace card dropdown)
  // ===========================================================================

  /**
   * Opens the workspace card dropdown menu.
   * @param workspaceName - The name of the workspace
   */
  async openWorkspaceCardDropdown(workspaceName: string): Promise<void> {
    const workspaceCard = this.workspaceCardLocator(workspaceName);
    await workspaceCard.getByLabel('Workspace actions menu button').click();
  }

  /**
   * Clicks the Export option in the workspace card dropdown.
   */
  async clickExportInDropdown(): Promise<void> {
    await this.page.getByRole('menuitem', { name: 'Export' }).click();
  }

  /**
   * Clicks the Export button in the Export Requests modal.
   */
  async clickExportButtonInExportRequestsModal(): Promise<void> {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();
  }

  /**
   * Selects the export format in the format selection modal.
   * @param format - The format to select ('yaml' for Insomnia v5, 'har' for HAR)
   */
  async selectExportFormat(format: 'yaml' | 'har'): Promise<void> {
    await this.page.getByText('Which format would you like to export as?').waitFor({ state: 'visible' });
    await this.page.getByTestId('Select Modal').locator('select').selectOption(format);
    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  /**
   * Mocks the save dialog to return a specific file path.
   * Used for single file exports from workspace card.
   * @param filePath - The file path to return
   */
  async mockSaveDialogForFile(filePath: string): Promise<void> {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      ipcMain.removeHandler('showSaveDialog');
      ipcMain.handle('showSaveDialog', async () => {
        return { filePath, canceled: false };
      });
    }, filePath);
  }

  /**
   * Exports a workspace from the workspace card dropdown.
   * Note: After calling this method, use waitForExportFiles() utility to ensure the file is written.
   * @param workspaceName - The name of the workspace to export
   * @param exportPath - The absolute path where the file should be exported
   * @param format - The export format ('yaml' or 'har')
   */
  async exportWorkspaceFromCard(
    workspaceName: string,
    exportPath: string,
    format: 'yaml' | 'har' = 'yaml',
  ): Promise<void> {
    // Mock the save dialog first
    await this.mockSaveDialogForFile(exportPath);

    // Open workspace card dropdown
    await this.openWorkspaceCardDropdown(workspaceName);

    // Click Export option
    await this.clickExportInDropdown();

    // Click Export button in the export requests modal (all requests selected by default)
    await this.clickExportButtonInExportRequestsModal();

    // Select export format
    await this.selectExportFormat(format);
  }
}
