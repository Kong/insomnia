import type { ElectronApplication, Page } from '@playwright/test';

import { StatusbarComponent } from './components/statusbar';
import { ProjectPage } from './dashboard/dashboard.page';

/**
 * Root facade for the Insomnia E2E Page Object Model.
 *
 * Instantiate **once** per test:
 *
 * ```ts
 * const insomnia = new InsomniaApp(page, app);
 *
 * // Login page
 * await insomnia.loginPage.loginForm.goToScratchPad();
 *
 * // Project operations
 * await insomnia.projectPage.importFixture('simple.yaml');
 * await insomnia.projectPage.createProject();
 *
 * // Shared components (statusbar is always present)
 * await insomnia.statusbar.openSettings();
 * ```
 *
 * ## Architecture
 *
 * ```
 * InsomniaApp (root)
 * ├── .statusbar     -> StatusbarComponent (convenience shortcut)
 * ├── .loginPage     -> LoginPage
 * │   ├── .statusbar    -> StatusbarComponent
 * │   └── .loginForm    -> LoginFormComponent
 * └── .projectPage     -> ProjectPage
 *     ├── .topNavbar    -> TopNavBarComponent
 *     ├── .statusbar    -> StatusbarComponent
 *     ├── .navbar       -> NavBarComponent
 *     ├── .tabbar       -> TabBarComponent
 *     ├── .sidebar      -> DashboardSidebarComponent
 *     ├── .toolbar      -> DashboardToolbarComponent
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
