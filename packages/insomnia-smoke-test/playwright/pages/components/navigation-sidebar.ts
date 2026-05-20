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
    const actionsButton = workspaceRow.getByLabel('SideBar Workspace Actions');
    // Sometimes the dropdown button can be a bit tricky to click if the hover state isn't properly triggered, so we'll add some retries here to make it more robust
    for (let attempt = 0; attempt < 3; attempt++) {
      await workspaceRow.hover();
      if (attempt > 0) {
        console.log(`Retrying to open workspace actions dropdown for "${workspaceName}", attempt ${attempt + 1}`);
      }
      try {
        await actionsButton.waitFor({ state: 'visible', timeout: 1000 });
        break;
      } catch {}
    }
    await actionsButton.click();
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

  async getWorkspaceParentName(workspaceName: string): Promise<string | null> {
    const workspaceRow = this.workspaceRow(workspaceName);
    const projectName = await workspaceRow.getAttribute('data-project');
    return projectName;
  }

  // ===========================================================================
  // Request / Request Group nodes
  // ===========================================================================

  requestRow(requestOrGroupName: string, workspaceName?: string): Locator {
    if (workspaceName) {
      // If workspaceName is provided, scope the locator to that workspace's subtree to avoid collisions between workspaces
      return this.root
        .getByTestId(`request-node-${requestOrGroupName}`)
        .and(this.page.locator(`[data-workspace="${workspaceName}"]`));
    }
    return this.root.getByTestId(`request-node-${requestOrGroupName}`);
  }

  pinnedRequestRow(requestName: string): Locator {
    return this.root.getByTestId(`pinned-request-node-${requestName}`);
  }

  async clickRequestOrFolder(requestOrGroupName: string, workspaceName?: string): Promise<void> {
    const row = this.requestRow(requestOrGroupName, workspaceName);
    await row.click();
  }

  async openRequestActionsDropdown(requestName: string, workspaceName?: string): Promise<void> {
    const requestRow = this.requestRow(requestName, workspaceName);
    const actionsButton = requestRow.getByLabel('Request Actions');
    // Sometimes the dropdown button can be a bit tricky to click if the hover state isn't properly triggered, so we'll add some retries here to make it more robust
    for (let attempt = 0; attempt < 3; attempt++) {
      await requestRow.hover();
      if (attempt > 0) {
        console.log(`Retrying to open request actions dropdown for "${requestName}", attempt ${attempt + 1}`);
      }
      try {
        await actionsButton.waitFor({ state: 'visible', timeout: 1000 });
        break;
      } catch {}
    }
    await actionsButton.click();
  }

  async openRequestGroupActionsDropdown(requestName: string, workspaceName?: string): Promise<void> {
    const requestRow = this.requestRow(requestName, workspaceName);
    const actionsButton = requestRow.getByLabel('Request Group Actions');
    // Sometimes the dropdown button can be a bit tricky to click if the hover state isn't properly triggered, so we'll add some retries here to make it more robust
    for (let attempt = 0; attempt < 3; attempt++) {
      await requestRow.hover();
      if (attempt > 0) {
        console.log(`Retrying to open request group actions dropdown for "${requestName}", attempt ${attempt + 1}`);
      }
      try {
        await actionsButton.waitFor({ state: 'visible', timeout: 1000 });
        break;
      } catch {}
    }
    await actionsButton.click();
  }

  async selectRequestDropdownOption({
    actionName,
    requestName,
    workspaceName,
  }: {
    actionName: string;
    requestName: string;
    workspaceName?: string;
  }): Promise<void> {
    await this.openRequestActionsDropdown(requestName, workspaceName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
  }

  async selectRequestGroupDropdownOption({
    actionName,
    requestGroupName,
    workspaceName,
  }: {
    actionName: string;
    requestGroupName: string;
    workspaceName?: string;
  }): Promise<void> {
    await this.openRequestGroupActionsDropdown(requestGroupName, workspaceName);
    await this.page.getByRole('menuitemradio', { name: actionName }).click();
  }

  async renameRequestOrFolder(requestName: string, newName: string): Promise<void> {
    const row = this.requestRow(requestName);
    await row.dblclick();
    const input = row.getByRole('textbox');
    await input.fill(newName);
    // Click outside the input to trigger the blur event
    await this.root.click();
  }

  async isRequestOrGroupSelected(requestOrGroupName: string): Promise<boolean> {
    const row = this.requestRow(requestOrGroupName);
    return (await row.getAttribute('data-selected')) === 'true';
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

  unsyncedWorkspaceRow(workspaceName: string): Locator {
    return this.root.getByTestId(`unsynced-workspace-node-${workspaceName}`);
  }

  unsyncedWorkspaceButton(workspaceName: string): Locator {
    return this.unsyncedWorkspaceRow(workspaceName).getByRole('button', { name: 'Fetch unsynced workspace' });
  }

  async fetchUnsyncedWorkspace(name: string): Promise<void> {
    const unsyncedWorkspaceButton = this.unsyncedWorkspaceButton(name);
    await unsyncedWorkspaceButton.click();
    await this.unsyncedWorkspaceRow(name)
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {});
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
