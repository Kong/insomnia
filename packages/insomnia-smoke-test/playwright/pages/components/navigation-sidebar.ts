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
    return this.root.getByLabel('Projects filter');
  }

  async fillFilter(text: string): Promise<void> {
    await this.filterInput.fill(text);
  }

  async clearFilter(): Promise<void> {
    await this.root.getByRole('button', { name: 'Clear search' }).click();
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
    const projectRow = this.projectRow(projectName);
    await projectRow.hover();
    await projectRow.getByLabel('Project Actions').click();
  }

  async selectProjectDropdownOption({
    actionName,
    projectName,
  }: {
    actionName: string;
    projectName: string;
  }): Promise<void> {
    await this.openProjectActionsDropdown(projectName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
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
  workspaceRow(workspaceName: string): Locator {
    return this.root.getByTestId(`workspace-node-${workspaceName}`);
  }

  async selectWorkspace(workspaceName: string): Promise<void> {
    await this.workspaceRow(workspaceName).click();
  }

  async openWorkspaceActionsDropdown(workspaceName: string): Promise<void> {
    const workspaceRow = this.workspaceRow(workspaceName);
    await workspaceRow.hover();
    await workspaceRow.getByLabel('SideBar Workspace Actions').click();
  }

  async selectWorkspaceDropdownOption({
    actionName,
    workspaceName,
  }: {
    actionName: string;
    workspaceName: string;
  }): Promise<void> {
    await this.openWorkspaceActionsDropdown(workspaceName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
  }

  async expandWorkspace(workspaceName: string): Promise<void> {
    await this.workspaceRow(workspaceName).getByLabel(`Expand ${workspaceName}`).click();
  }

  async collapseWorkspace(workspaceName: string): Promise<void> {
    await this.workspaceRow(workspaceName).getByLabel(`Collapse ${workspaceName}`).click();
  }

  // ===========================================================================
  // Request / Request Group nodes
  // ===========================================================================

  requestRow(requestOrGroupName: string): Locator {
    return this.root.getByTestId(`request-node-${requestOrGroupName}`);
  }

  pinnedRequestRow(requestName: string): Locator {
    return this.root.getByTestId(`pinned-request-node-${requestName}`);
  }

  async clickRequestOrFolder(requestOrGroupName: string): Promise<void> {
    const row = this.requestRow(requestOrGroupName);
    await row.click();
  }

  async openRequestActionsDropdown(requestName: string): Promise<void> {
    const requestRow = this.requestRow(requestName);
    await requestRow.hover();
    await requestRow.getByLabel('Request Actions').click();
  }

  async openRequestGroupActionsDropdown(requestName: string): Promise<void> {
    const requestRow = this.requestRow(requestName);
    await requestRow.hover();
    await requestRow.getByLabel('Request Group Actions').click();
  }

  async selectRequestDropdownOption({
    actionName,
    requestName,
  }: {
    actionName: string;
    requestName: string;
  }): Promise<void> {
    await this.openRequestActionsDropdown(requestName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
  }

  async selectRequestGroupDropdownOption({
    actionName,
    requestGroupName,
  }: {
    actionName: string;
    requestGroupName: string;
  }): Promise<void> {
    await this.openRequestGroupActionsDropdown(requestGroupName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
  }

  async pinRequest(requestName: string): Promise<void> {
    await this.openRequestActionsDropdown(requestName);
    await this.page.getByRole('menuitemradio', { name: 'Pin' }).click();
  }

  async unpinRequest(requestName: string): Promise<void> {
    const requestRow = this.requestRow(requestName);
    await requestRow.hover();
    await requestRow.getByLabel('Unpin request').click();
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
