import type { Page } from '@playwright/test';

/**
 * Component for the **dashboard sidebar** (left panel on dashboard).
 *
 * Contains the organization dropdown, project list, and workspace
 * scope filter (All, Document, Collection, MCP, Mock Server, Environment).
 */
export class ProjectSidebarComponent {
  constructor(readonly page: Page) {}

  get root() {
    return this.page.locator('.app #sidebar');
  }

  /** Select a project by name in the sidebar project list. */
  async selectProject(name: string): Promise<void> {
    await this.root.getByRole('row', { name }).click();
  }

  /**
   * Select a workspace filter scope.
   * @param filter - One of 'All', 'Document', 'Collection', 'MCP', 'Mock Server', 'Environment'
   */
  async selectWorkspaceFilter(
    filter: 'All' | 'Document' | 'Collection' | 'MCP' | 'Mock Server' | 'Environment',
  ): Promise<void> {
    await this.root.getByLabel(filter).click();
  }
}
