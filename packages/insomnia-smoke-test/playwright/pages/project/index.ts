import type { ElectronApplication, Page } from '@playwright/test';

import { loadFixture } from '../../paths';
import { mockSaveDialogForFile } from '../../utils';
import { BasePage } from '../base-page';
import { NavigationSidebar } from '../components/navigation-sidebar';
import { WorkspaceListComponent } from './workspace-list';

export type ProjectStorageType = 'local' | 'remote' | 'git';

const storageTypeNames: Record<ProjectStorageType, string> = {
  local: 'Local Vault',
  remote: 'Cloud Sync',
  git: 'Git Sync',
};

/**
 * Page Object for the **project page** (file list view).
 *
 * Visible at route: `/organization/:orgId/project/:projectId`
 *
 * Composes shared layout components and project-specific components:
 * - TopNavBar, Statusbar, NavBar, TabBar (layout)
 * - Sidebar, Toolbar, WorkspaceList (project-specific)
 */
export class ProjectPage extends BasePage {
  /** The workspace list (files). */
  readonly workspaceList: WorkspaceListComponent;
  readonly sidebar: NavigationSidebar;
  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    super(page);
    this.workspaceList = new WorkspaceListComponent(page);
    this.sidebar = new NavigationSidebar(page);
  }

  /** The root app container. */
  get root() {
    return this.page.locator('.app');
  }

  get scanButton() {
    return this.page.getByRole('button', { name: 'Scan' });
  }

  get importButton() {
    return this.page.getByRole('dialog').getByRole('button', { name: 'Import' });
  }

  // ===========================================================================
  // Project Creation
  // ===========================================================================

  /**
   * Sets the project name in the create/edit modal.
   * @param name - The project name
   */
  private async setProjectName(name: string): Promise<void> {
    const input = this.page.getByPlaceholder('My Project');
    await input.click();
    await input.fill(name);
  }

  /**
   * Selects the storage type for the project.
   * @param storageType - The storage type: 'local' (Local Vault), 'remote' (Cloud Sync), or 'git' (Git Sync)
   */
  private async selectStorageType(storageType: ProjectStorageType): Promise<void> {
    await this.page.getByText(storageTypeNames[storageType]).click();
  }

  /**
   * Creates a new project with the specified name and storage type.
   * @param name - The project name (defaults to 'My Project')
   * @param storageType - The storage type (defaults to 'local')
   */
  async createProject(name = 'My Project', storageType: ProjectStorageType = 'local'): Promise<void> {
    await this.page.getByRole('button', { name: 'Create new Project' }).click();
    await this.setProjectName(name);
    await this.selectStorageType(storageType);
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  async createGitSyncProject(name = 'My Git Project'): Promise<void> {
    await this.sidebar.clickNewProject();
    await this.page.getByRole('textbox', { name: 'Project name' }).click();
    await this.page.getByRole('textbox', { name: 'Project name' }).press('ControlOrMeta+a');
    await this.page.getByRole('textbox', { name: 'Project name' }).fill(name);
    await this.page.getByText('Git Sync').click();
    await this.page.getByRole('button', { name: 'Access Token author Git' }).click();
    await this.page.getByRole('option', { name: 'Custom Git Credential' }).click();
    await this.page.getByRole('textbox', { name: 'Repository URL' }).click();
    await this.page.getByRole('textbox', { name: 'Repository URL' }).fill('git-server.git');
    await this.page.getByRole('button', { name: 'Show suggestions Branch' }).click();
    await this.page.getByRole('option', { name: 'master' }).click();
    await this.page.getByRole('button', { name: 'Scan for files' }).click();
    await this.page.getByRole('button', { name: 'Create Blank Project' }).click();
    const projectModalCloseButton = this.page.locator('[data-test-id="project-modal-close-button"]');
    await projectModalCloseButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await projectModalCloseButton.isVisible()) {
      await projectModalCloseButton.click();
    }
    await this.page.getByRole('button', { name: 'Personal workspace Organizations' }).click();
    await this.page.getByRole('option', { name: /Magic/ }).click();
    await this.page.getByRole('button', { name: /Magic/ }).click();
    await this.page.getByRole('option', { name: 'Personal workspace' }).locator('span').click();
    await this.sidebar.selectProject(name);
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
    await this.scanButton.click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await this.page.getByRole('dialog').waitFor({ state: 'hidden' });
    // After import the app either navigates into the workspace (single collection)
    // or stays on the project page (multiple collections). 2 s is enough to detect navigation.
    await this.page
      .getByTestId('workspace-breadcrumb-level-0')
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => {});
  }

  /**
   * Imports multiple fixture files into the project via clipboard.
   * After each import, navigates back to the project page to continue importing.
   * @param fixturePaths - Array of paths relative to fixtures directory
   */
  async importMultipleFixtures(fixturePaths: string[]): Promise<void> {
    for (const fixturePath of fixturePaths) {
      const content = await loadFixture(fixturePath);
      await this.importFixture(fixturePath);

      // After import, app redirects to workspace page
      // Navigate back to project page for next import or to continue testing
      await this.page.getByTestId('workspace-breadcrumb-level-0').waitFor({ state: 'visible' });
      await this.page.getByTestId('workspace-breadcrumb-level-0').click();
    }
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
    await mockSaveDialogForFile(this.app, exportPath);

    // Open workspace card dropdown
    await this.workspaceList.openWorkspaceCardDropdown(workspaceName);

    // Click Export option
    await this.page.getByRole('menuitem', { name: 'Export' }).click();

    // Click Export button in the export requests modal (all requests selected by default)
    await this.page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();

    // Select export format
    await this.exportModal.selectExportFormat(format);
  }
}
