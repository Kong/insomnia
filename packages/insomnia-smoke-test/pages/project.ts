import type { ElectronApplication, Page } from '@playwright/test';

import { getFixturePath, loadFixture } from '../playwright/paths';
import { WorkspacePage } from './workspace';

export type ProjectStorageType = 'local' | 'remote' | 'git';

/**
 * Page Object for the Project page
 * Handles project creation and file import operations
 */
export class ProjectPage {
  readonly page: Page;
  readonly app: ElectronApplication;

  constructor(page: Page, app: ElectronApplication) {
    this.page = page;
    this.app = app;
  }

  // ==================== Project Creation ====================

  /**
   * Opens the create project modal
   */
  async openCreateProjectModal() {
    await this.page.getByRole('button', { name: 'Create new Project' }).click();
  }

  /**
   * Sets the project name in the create/edit modal
   * @param name - The project name
   */
  async setProjectName(name: string) {
    const input = this.page.getByPlaceholder('My Project');
    await input.click();
    await input.fill(name);
  }

  /**
   * Selects the storage type for the project
   * @param storageType - The storage type: 'local' (Local Vault), 'remote' (Cloud Sync), or 'git' (Git Sync)
   */
  async selectStorageType(storageType: ProjectStorageType) {
    await this.page.getByText(this.getStorageTypeName(storageType)).click();
  }

  /**
   * Gets the display name for a storage type
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
   * Clicks the Create button in the modal
   */
  async clickCreateButton() {
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  /**
   * Creates a new project with the specified name and storage type
   * @param name - The project name (defaults to 'My Project')
   * @param storageType - The storage type (defaults to 'local')
   */
  async createProject(name = 'My Project', storageType: ProjectStorageType = 'local') {
    await this.openCreateProjectModal();
    if (name !== 'My Project') {
      await this.setProjectName(name);
    }
    await this.selectStorageType(storageType);
    await this.clickCreateButton();
  }

  /**
   * Selects a project from the sidebar by name
   * @param projectName - The name of the project to select
   */
  async selectProject(projectName: string) {
    await this.page.getByRole('row', { name: projectName }).first().click();
  }

  // ==================== Import Operations ====================

  /**
   * Opens the import modal from the empty project view
   * Use this when the project has no workspaces
   */
  async openImportModalFromEmptyProject() {
    await this.page.getByRole('button', { name: 'Import', exact: true }).click();
  }

  /**
   * Opens the import modal from the toolbar
   * Use this when the project already has workspaces
   */
  async openImportModalFromToolbar() {
    await this.page.getByLabel('Import').click();
  }

  /**
   * Selects the import source type in the import modal
   * @param source - The import source: 'file', 'uri', 'curl', or 'clipboard'
   */
  async selectImportSource(source: 'file' | 'uri' | 'curl' | 'clipboard') {
    await this.page.locator(`[data-test-id="import-from-${source}"]`).click();
  }

  /**
   * Mocks the file dialog to return the specified file path
   * This is required because Electron's file dialog cannot be automated directly
   * @param filePath - The absolute path to the file to import
   */
  async mockFileDialog(filePath: string) {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      ipcMain.removeHandler('showOpenDialog');
      ipcMain.handle('showOpenDialog', async () => {
        return { filePaths: [filePath], canceled: false };
      });
    }, filePath);
  }

  /**
   * Sets the file paths to import by directly manipulating the hidden input
   * @param filePaths - Array of file paths to import
   */
  async setImportFilePaths(filePaths: string[]) {
    // The file input stores paths as JSON in a hidden input
    const filePathsJson = JSON.stringify(filePaths);
    await this.page.evaluate(filePathsJson => {
      const hiddenInput = document.querySelector('input[name="filePaths"]') as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.value = filePathsJson;
      }
    }, filePathsJson);
  }

  /**
   * Sets the URL for URI import
   * @param url - The URL to import from
   */
  async setImportUrl(url: string) {
    await this.page.locator('input[name="uri"]').fill(url);
  }

  /**
   * Sets the cURL command for cURL import
   * @param curlCommand - The cURL command to import
   */
  async setImportCurl(curlCommand: string) {
    await this.page.locator('input[name="curl"]').fill(curlCommand);
  }

  /**
   * Clicks the Scan button in the import modal
   */
  async clickScanButton() {
    await this.page.getByRole('button', { name: 'Scan' }).click();
  }

  /**
   * Clicks the Import button in the import modal (after scanning)
   */
  async clickImportButton() {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  }

  /**
   * Waits for the import to complete by checking for workspace cards or navigation
   */
  async waitForImportComplete() {
    // Wait for the modal to close (import redirects or closes modal)
    await this.page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10_000 });
  }

  /**
   * Imports a file into the project from an empty project state
   * @param filePath - The absolute path to the file to import
   */
  async importFileFromEmptyProject(filePath: string) {
    await this.openImportModalFromEmptyProject();
    await this.importFileCommon(filePath);
  }

  /**
   * Imports a file into the project when workspaces already exist
   * @param filePath - The absolute path to the file to import
   */
  async importFileFromToolbar(filePath: string) {
    await this.openImportModalFromToolbar();
    await this.importFileCommon(filePath);
  }

  /**
   * Set the import file paths on the hidden input and dispatch an input event.
   * This consolidates value assignment and event dispatch into a single DOM operation.
   */
  private async setImportFilePathsAndDispatch(filePaths: string[]) {
    await this.page.evaluate((paths: string[]) => {
      const hiddenInput = document.querySelector('input[name="filePaths"]') as HTMLInputElement | null;
      if (hiddenInput) {
        hiddenInput.value = JSON.stringify(paths);
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, filePaths);
  }

  /**
   * Common import file logic shared between empty and non-empty project states
   * @param filePath - The absolute path to the file to import
   */
  private async importFileCommon(filePath: string) {
    await this.selectImportSource('file');

    // Set file path and trigger the input event in a single DOM operation
    await this.setImportFilePathsAndDispatch([filePath]);
    await this.clickScanButton();
    await this.clickImportButton();
    await this.waitForImportComplete();
  }

  /**
   * Imports content from clipboard into the project from an empty project state
   * @param content - The content to import (will be written to clipboard)
   */
  async importFromClipboardEmptyProject(content: string) {
    await this.app.evaluate(async ({ clipboard }, content) => clipboard.writeText(content), content);
    await this.openImportModalFromEmptyProject();
    await this.selectImportSource('clipboard');
    await this.clickScanButton();
    await this.clickImportButton();
    await this.waitForImportComplete();
  }

  /**
   * Imports content from clipboard into the project when workspaces already exist
   * @param content - The content to import (will be written to clipboard)
   */
  async importFromClipboardToolbar(content: string) {
    await this.app.evaluate(async ({ clipboard }, content) => clipboard.writeText(content), content);
    await this.openImportModalFromToolbar();
    await this.selectImportSource('clipboard');
    await this.clickScanButton();
    await this.clickImportButton();
    await this.waitForImportComplete();
  }

  // ==================== Workspace Verification ====================

  /**
   * Verifies that a workspace (collection/document) exists in the project
   * @param workspaceName - The name of the workspace to check
   * @returns true if the workspace exists
   */
  async hasWorkspace(workspaceName: string) {
    const workspace = this.page.getByLabel(workspaceName);
    return workspace.isVisible();
  }

  /**
   * Gets the workspace card locator for a given workspace name
   * @param workspaceName - The name of the workspace
   */
  getWorkspaceCard(workspaceName: string) {
    return this.page.getByLabel('Files').getByLabel(workspaceName);
  }

  /**
   * Waits for the project empty view to be visible
   */
  async waitForEmptyProjectView() {
    await this.page.getByText('Welcome to your project!').waitFor({ state: 'visible' });
  }

  /**
   * Checks if the project is empty (no workspaces)
   */
  async isProjectEmpty() {
    return this.page.getByText('Welcome to your project!').isVisible();
  }

  /**
   * Gets the count of all files in the current project
   */
  async getFilesCount(): Promise<number> {
    const allFilesText = await this.page.getByLabel(/All Files \(\d+\)/).textContent();
    const match = allFilesText?.match(/All Files \((\d+)\)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  // ==================== Fixture Import Methods ====================

  /**
   * Imports a fixture file into the project via clipboard (empty project)
   * This is the recommended way to import files in tests as it's more reliable
   * @param fixturePath - Path relative to fixtures directory (e.g., 'export/Collection-A.yaml')
   */
  async importFixtureFromEmptyProject(fixturePath: string) {
    const content = await loadFixture(fixturePath);
    await this.importFromClipboardEmptyProject(content);
  }

  /**
   * Imports a fixture file into the project via clipboard (project with workspaces)
   * @param fixturePath - Path relative to fixtures directory (e.g., 'export/Collection-A.yaml')
   */
  async importFixtureFromToolbar(fixturePath: string) {
    const content = await loadFixture(fixturePath);
    await this.importFromClipboardToolbar(content);
  }

  /**
   * Imports multiple fixture files into the project via clipboard
   * After each import, navigates back to the project page to continue importing
   * @param fixturePaths - Array of paths relative to fixtures directory
   */
  async importMultipleFixtures(fixturePaths: string[]) {
    const workspacePage = new WorkspacePage(this.page);
    let isFirstImport = true;

    for (const fixturePath of fixturePaths) {
      const content = await loadFixture(fixturePath);
      if (isFirstImport) {
        // First import - check if project is empty
        const isEmpty = await this.isProjectEmpty();
        isEmpty
          ? await this.importFromClipboardEmptyProject(content)
          : await this.importFromClipboardToolbar(content);
        isFirstImport = false;
      } else {
        // Subsequent imports - project will have workspaces
        await this.importFromClipboardToolbar(content);
      }

      // After import, app redirects to workspace page
      // Navigate back to project page for next import or to continue testing
      await workspacePage.waitForWorkspaceLoaded();
      await workspacePage.goBackToProject();
    }
  }

  /**
   * Gets the absolute path to a fixture file
   * Useful when you need to pass the file path to other tools
   * @param fixturePath - Path relative to fixtures directory
   */
  getFixtureAbsolutePath(fixturePath: string): string {
    return getFixturePath(fixturePath);
  }

  /**
   * Reads fixture file content directly
   * @param fixturePath - Path relative to fixtures directory
   */
  async readFixtureContent(fixturePath: string): Promise<string> {
    return loadFixture(fixturePath);
  }

  // ==================== Workspace Export Operations ====================

  /**
   * Opens the workspace card dropdown menu
   * @param workspaceName - The name of the workspace
   */
  async openWorkspaceCardDropdown(workspaceName: string) {
    const workspaceCard = this.getWorkspaceCard(workspaceName);
    await workspaceCard.getByLabel('Workspace actions menu button').click();
  }

  /**
   * Clicks the Export option in the workspace card dropdown
   */
  async clickExportInDropdown() {
    await this.page.getByRole('menuitem', { name: 'Export' }).click();
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
   * Used for single file exports from workspace card
   * @param filePath - The file path to return
   */
  async mockSaveDialogForFile(filePath: string) {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      ipcMain.removeHandler('showSaveDialog');
      ipcMain.handle('showSaveDialog', async () => {
        return { filePath, canceled: false };
      });
    }, filePath);
  }

  /**
   * Exports a workspace from the workspace card dropdown
   * Note: After calling this method, use DataPage.waitForExportFiles() to ensure the file is written
   * @param workspaceName - The name of the workspace to export
   * @param exportPath - The absolute path where the file should be exported
   * @param format - The export format ('yaml' or 'har')
   */
  async exportWorkspaceFromCard(workspaceName: string, exportPath: string, format: 'yaml' | 'har' = 'yaml') {
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
