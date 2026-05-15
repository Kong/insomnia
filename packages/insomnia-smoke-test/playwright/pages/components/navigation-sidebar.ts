import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the **project navigation sidebar** (left-side tree).
 */
export class NavigationSidebar {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId('global-navigation-sidebar');
  }

  get navigationTree(): Locator {
    return this.root.getByLabel('Project Navigation Tree');
  }

  // ===========================================================================
  // Tab controls
  // ===========================================================================

  async clickProjectsTab(): Promise<void> {
    await this.root.getByTestId('sidebar-tab-projects').click();
  }

  async clickKonnectTab(): Promise<void> {
    await this.root.getByTestId('sidebar-tab-konnect').click();
  }

  // ===========================================================================
  // Filter input
  // ===========================================================================

  get filterInput(): Locator {
    return this.root.getByLabel('Projects filter').getByRole('textbox');
  }

  async filter(text: string): Promise<void> {
    await this.filterInput.fill(text);
  }

  async clearFilter(): Promise<void> {
    await this.root.getByLabel('Projects filter').getByRole('button').click();
  }

  // ===========================================================================
  // Project nodes
  // ===========================================================================

  async clickNewProject(): Promise<void> {
    await this.root.getByLabel('Create new Project').click();
  }

  projectRow(projectName: string): Locator {
    return this.navigationTree.getByTestId(`project-node-${projectName}`);
  }

  async selectProject(projectName: string): Promise<void> {
    await this.projectRow(projectName).click();
  }

  async openProjectActionsDropdown(projectName: string): Promise<void> {
    await this.projectRow(projectName).getByLabel('Project Actions').click();
  }

  async expandProject(projectName: string): Promise<void> {
    await this.projectRow(projectName).getByLabel(`Expand ${projectName}`).click();
  }

  async collapseProject(projectName: string): Promise<void> {
    await this.projectRow(projectName).getByLabel(`Collapse ${projectName}`).click();
  }

  // ===========================================================================
  // Workspace nodes
  // ===========================================================================
  workspaceRow(workspaceName: string, projectName?: string): Locator {
    if (projectName) {
      return this.projectRow(projectName).getByTestId(`workspace-node-${workspaceName}`);
    }
    return this.root.getByTestId(`workspace-node-${workspaceName}`);
  }

  async selectWorkspace(workspaceName: string, projectName: string): Promise<void> {
    await this.workspaceRow(workspaceName, projectName).click();
  }

  async openWorkspaceActionsDropdown(workspaceName: string, projectName?: string): Promise<void> {
    await this.workspaceRow(workspaceName, projectName).getByLabel('SideBar Workspace Actions').click();
  }

  async expandWorkspace(workspaceName: string, projectName: string): Promise<void> {
    await this.workspaceRow(workspaceName, projectName).getByLabel(`Expand ${workspaceName}`).click();
  }

  async collapseWorkspace(workspaceName: string, projectName: string): Promise<void> {
    await this.workspaceRow(workspaceName, projectName).getByLabel(`Collapse ${workspaceName}`).click();
  }

  // ===========================================================================
  // Request / Request Group nodes
  // ===========================================================================

  requestRow(requestOrGroupName: string, workspaceName?: string, projectName?: string): Locator {
    if (projectName) {
      return workspaceName
        ? this.projectRow(projectName)
            .getByTestId(`workspace-node-${workspaceName}`)
            .getByTestId(`request-node-${requestOrGroupName}`)
        : this.projectRow(projectName).getByTestId(`request-node-${requestOrGroupName}`);
    }

    if (workspaceName) {
      return this.workspaceRow(workspaceName).getByTestId(`request-node-${requestOrGroupName}`);
    }

    return this.root.getByTestId(`request-node-${requestOrGroupName}`);
  }

  async clickRequestOrFolder(requestOrGroupName: string, workspaceName?: string, projectName?: string): Promise<void> {
    const row = this.requestRow(requestOrGroupName, workspaceName, projectName);

    await row.click();
  }

  async openRequestActionsDropdown(requestName: string, workspaceName?: string, projectName?: string): Promise<void> {
    await this.requestRow(requestName, workspaceName, projectName).getByLabel('Request Actions').click();
  }

  async expandFolder(folderName: string): Promise<void> {
    await this.root.getByLabel(`Expand ${folderName}`).click();
  }

  async collapseFolder(folderName: string): Promise<void> {
    await this.root.getByLabel(`Collapse ${folderName}`).click();
  }

  // ===========================================================================
  // Unsynced workspace nodes
  // ===========================================================================

  unsyncedWorkspaceButton(name: string): Locator {
    return this.navigationTree.getByRole('row', { name }).getByRole('button', { name });
  }

  async fetchUnsyncedWorkspace(name: string): Promise<void> {
    await this.unsyncedWorkspaceButton(name).click();
  }

  // ===========================================================================
  // Empty-state nodes (emptyProject / emptyCollection / emptyFolder)
  // ===========================================================================

  async openEmptyNodeCreateMenu(): Promise<void> {
    await this.root.getByLabel('Create in project').click();
  }

  async selectCreateAction(actionName: string): Promise<void> {
    await this.openEmptyNodeCreateMenu();
    await this.page.getByRole('menuitem', { name: actionName }).click();
  }
}
