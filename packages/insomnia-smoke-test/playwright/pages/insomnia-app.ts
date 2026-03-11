import type { ElectronApplication, Page } from '@playwright/test';

import { StatusbarComponent } from './components/statusbar';
import { ProjectPage } from './project';

/**
 * Root facade for the Insomnia E2E Page Object Model.
 *
 * ```ts
 * test('example test', async ({ insomnia }) => {
 *  // Project operations
 *  await insomnia.projectPage.importFixture('simple.yaml');
 *
 *  // Shared components (statusbar is always present)
 *  await insomnia.statusbar.openPreferences();
 * });
 * ```
 *
 * ## Architecture
 *
 * ```
 * InsomniaApp (root)
 * ├── .statusbar     -> StatusbarComponent (convenience shortcut)
 * └── .projectPage     -> ProjectPage
 *     ├── .sidebar      -> ProjectSidebarComponent
 *     └── .workspaceList -> WorkspaceListComponent
 * ```
 */
export class InsomniaApp {
  // ===========================================================================
  // Shared components (layout level)
  // ===========================================================================

  /** Statusbar (footer) — always visible. */
  readonly statusbar: StatusbarComponent;

  // ===========================================================================
  // Page objects
  // ===========================================================================

  /** Project page (project/file list). */
  readonly projectPage: ProjectPage;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    // Shared components
    this.statusbar = new StatusbarComponent(page);

    // Pages
    this.projectPage = new ProjectPage(page, app);
  }

  // ===========================================================================
  // Global utilities
  // ===========================================================================

  /** Press Escape on the app container (closes modals, dropdowns, overlays). */
  async pressEscape(): Promise<void> {
    await this.page.locator('.app').press('Escape');
  }
}
