import type { Page } from '@playwright/test';

/**
 * Page Object for the Workspace page (debug view)
 * Handles workspace-level operations including navigation
 */
export class WorkspacePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates back to the project page using the breadcrumb back button
   */
  async goBackToProject() {
    await this.page.getByTestId('project').click();
  }

  /**
   * Waits for the workspace page to be loaded
   */
  async waitForWorkspaceLoaded() {
    // Wait for the breadcrumb to be visible, indicating workspace is loaded
    await this.page.getByTestId('project').waitFor({ state: 'visible' });
  }
}
