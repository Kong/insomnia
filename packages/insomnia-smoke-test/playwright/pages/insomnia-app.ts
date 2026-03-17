import type { ElectronApplication, Page } from '@playwright/test';

import { ExportModal } from './components/export-modal';
import { StatusbarComponent } from './components/statusbar';
import { PreferencesPage } from './preferences';
import { ProjectPage } from './project';
import { WorkspacePage } from './workspace';

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
 *
 *  // Preferences and export
 *  await insomnia.preferencesPage.dataTab.exportProjectData('My Project');
 * });
 * ```
 *
 * ## Architecture
 *
 * ```
 * InsomniaApp (root)
 * ├── .statusbar         -> StatusbarComponent (convenience shortcut)
 * ├── .projectPage       -> ProjectPage
 * │   ├── .sidebar      -> ProjectSidebarComponent
 * │   └── .workspaceList -> WorkspaceListComponent
 * ├── .workspacePage     -> WorkspacePage
 * └── .preferencesPage   -> PreferencesPage
 *     └── .dataTab       -> PreferencesDataTab
 * ```
 */
export class InsomniaApp {
  // ===========================================================================
  // Shared components (layout level)
  // ===========================================================================

  /** Statusbar (footer) — always visible. */
  readonly statusbar: StatusbarComponent;

  // global export modal
  readonly exportModal: ExportModal;

  // ===========================================================================
  // Page objects
  // ===========================================================================

  /** Project page (project/file list). */
  readonly projectPage: ProjectPage;

  /** Workspace page (debug view). */
  readonly workspacePage: WorkspacePage;

  /** Preferences page (settings modal). */
  readonly preferencesPage: PreferencesPage;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    // Shared components
    this.statusbar = new StatusbarComponent(page);
    this.exportModal = new ExportModal(page);

    // Pages
    this.projectPage = new ProjectPage(page, app);
    this.workspacePage = new WorkspacePage(page, app);
    this.preferencesPage = new PreferencesPage(page, app);
  }

  // ===========================================================================
  // Global utilities
  // ===========================================================================

  /** Press Escape on the app container (closes modals, dropdowns, overlays). */
  async pressEscape(): Promise<void> {
    await this.page.locator('.app').press('Escape');
  }
}
