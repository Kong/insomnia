import type { ElectronApplication, Page } from '@playwright/test';

import { loadFixture } from '../../paths';
import { WorkspaceListComponent } from './workspace-list';

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
  // Import (ONLY available on project page)
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
}
