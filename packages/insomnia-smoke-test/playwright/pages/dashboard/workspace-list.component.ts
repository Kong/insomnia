import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Component for the **workspace list** on the dashboard.
 *
 * Displays workspace items (collections, documents, mock servers, etc.)
 * with actions like open, rename, duplicate, and delete.
 */
export class WorkspaceListComponent {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId('workspace-grid');
  }

  locatorForWorkspace(name: string): Locator {
    return this.root.getByLabel(name);
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  /** Open a workspace by clicking its name. */
  async openWorkspace(name: string): Promise<void> {
    await this.locatorForWorkspace(name).click();
  }
}
