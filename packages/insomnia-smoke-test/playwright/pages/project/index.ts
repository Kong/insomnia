import type { ElectronApplication, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { loadFixture } from '../../paths';
import { ProjectSidebarComponent } from './sidebar';
import { WorkspaceListComponent } from './workspace-list';

/**
 * Page Object for the **project dashboard** (file list view).
 *
 * Visible at route: `/organization/:orgId/project/:projectId`
 *
 * Composes shared layout components and dashboard-specific components:
 * - TopNavBar, Statusbar, NavBar, TabBar (layout)
 * - Sidebar, Toolbar, WorkspaceList (dashboard-specific)
 */
export class ProjectPage {
  /** The sidebar (projects, workspace filter). */
  readonly sidebar: ProjectSidebarComponent;

  /** The workspace list (files). */
  readonly workspaceList: WorkspaceListComponent;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    this.sidebar = new ProjectSidebarComponent(page);
    this.workspaceList = new WorkspaceListComponent(page);
  }

  /** The root app container. */
  get root() {
    return this.page.locator('.app');
  }

  // ===========================================================================
  // Import (ONLY available on project page)
  // ===========================================================================

  /**
   * Import a fixture file from clipboard.
   * This is the most common operation in tests.
   */
  async importFixture(fixturePath: string): Promise<void> {
    const text = await loadFixture(fixturePath);
    await this.app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await this.page.getByLabel('Import').click();
    await this.page.locator('[data-test-id="import-from-clipboard"]').click();
    await this.page.getByRole('button', { name: 'Scan' }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  }

  // ===========================================================================
  // Documents
  // ===========================================================================

  /** Create a new design document. */
  async createDocument(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create document', exact: true }).click();
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  // ===========================================================================
  // Collections
  // ===========================================================================

  /** Create a new request collection. */
  async createCollection(): Promise<void> {
    await this.page.getByLabel('Create in project').click();
    await this.page.getByText('Request collection').click();
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  }

  // ===========================================================================
  // Scope filter
  // ===========================================================================

  /** Click a scope filter (e.g. "All Files (0)"). */
  async selectScope(label: string): Promise<void> {
    await this.page.getByLabel(label).click();
  }

  // ===========================================================================
  // Assertions
  // ===========================================================================

  /** Assert the dashboard contains text. */
  async expectContains(text: string): Promise<void> {
    await expect.soft(this.root).toContainText(text);
  }

  /** Assert the dashboard does NOT contain text. */
  async expectNotContains(text: string): Promise<void> {
    await expect.soft(this.root).not.toContainText(text);
  }
}
