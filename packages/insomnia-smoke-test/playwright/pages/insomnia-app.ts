import type { ElectronApplication, Page } from '@playwright/test';

import { launchInsomnia } from '../launch';
import { ExportModal } from './components/export-modal';
import { NavigationSidebar } from './components/navigation-sidebar';
import { StatusbarComponent } from './components/statusbar';
import { PreferencesPage } from './preferences';
import { ProjectPage } from './project';
import { WorkspacePage } from './workspace';

/**
 * `ElectronApplication` with the launch-env metadata stashed by the `app`
 * fixture. Named here to avoid the duplicated intersection cast that used to
 * appear inside `relaunch()` and `launchClone()`.
 */
type StashedApp = ElectronApplication & {
  __launchEnv?: Record<string, string>;
  __playwright?: any;
};

/** Attach launch-env metadata to an `ElectronApplication` instance. */
function stashLaunchEnv(app: ElectronApplication, env: Record<string, string>, playwright: any) {
  const s = app as StashedApp;
  s.__launchEnv = env;
  s.__playwright = playwright;
}

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
 * ├── .statusbar           -> StatusbarComponent (footer, always visible)
 * ├── .navigationSidebar   -> NavigationSidebar (left-side tree, always visible)
 * ├── .projectPage         -> ProjectPage
 * │   └── .workspaceList  -> WorkspaceListComponent
 * ├── .workspacePage       -> WorkspacePage
 * └── .preferencesPage     -> PreferencesPage
 *     └── .dataTab         -> PreferencesDataTab
 * ```
 */
export class InsomniaApp {
  // ===========================================================================
  // Shared components (layout level)
  // ===========================================================================

  /** Statusbar (footer) — always visible. */
  statusbar!: StatusbarComponent;

  // global export modal
  exportModal!: ExportModal;

  /** Project navigation sidebar — always visible (except login). */
  navigationSidebar!: NavigationSidebar;

  // ===========================================================================
  // Page objects
  // ===========================================================================

  /** Project page (project/file list). */
  projectPage!: ProjectPage;

  /** Workspace page (debug view). */
  workspacePage!: WorkspacePage;

  /** Preferences page (settings modal). */
  preferencesPage!: PreferencesPage;

  // Private backing fields exposed as readonly getters so that external callers
  // cannot reassign them, while `relaunch()` can update them after a relaunch.
  private _page: Page;
  private _app: ElectronApplication;

  get page(): Page {
    return this._page;
  }

  get app(): ElectronApplication {
    return this._app;
  }

  constructor(page: Page, app: ElectronApplication) {
    this._page = page;
    this._app = app;
    this._initPageObjects();
  }

  private _initPageObjects() {
    this.statusbar = new StatusbarComponent(this._page);
    this.exportModal = new ExportModal(this._page);
    this.navigationSidebar = new NavigationSidebar(this._page);
    this.projectPage = new ProjectPage(this._page, this._app);
    this.workspacePage = new WorkspacePage(this._page, this._app);
    this.preferencesPage = new PreferencesPage(this._page, this._app);
  }

  /** Read the stashed launch env/playwright from the underlying Electron app, or throw. */
  private _unstash(): { env: Record<string, string>; playwright: any } {
    const s = this._app as StashedApp;
    const env = s.__launchEnv;
    const playwright = s.__playwright;
    if (!env || !playwright) {
      throw new Error(
        'Launch env was not stashed on the ElectronApplication. ' +
          'Ensure the test was started via the `app` fixture in playwright/test.ts.',
      );
    }
    return { env, playwright };
  }

  // ===========================================================================
  // Global utilities
  // ===========================================================================

  /** Press Escape on the app container (closes modals, dropdowns, overlays). */
  async pressEscape(): Promise<void> {
    await this._page.locator('.app').press('Escape');
  }

  /**
   * Queue a fake response for the next Electron `showOpenDialog` call.
   * Consumed by the main-process handler when `PLAYWRIGHT === 'true'`.
   */
  async queueOpenDialogResponse(filePaths: string[], canceled = false): Promise<void> {
    await this._app.evaluate(
      (_electron, payload) => {
        const g = globalThis as any;
        g.__PLAYWRIGHT_OPEN_DIALOG_QUEUE__ ||= [];
        g.__PLAYWRIGHT_OPEN_DIALOG_QUEUE__.push(payload);
      },
      { filePaths, canceled },
    );
  }

  /**
   * Close the current Electron process and relaunch it reusing the same env
   * vars (including INSOMNIA_DATA_PATH) so on-disk state — NeDB, secret store —
   * is preserved across the cycle. After this returns, `this.app` and
   * `this.page` point at the fresh process; all page objects are rebuilt.
   *
   * The launch env is stashed on the app instance by the `app` fixture in
   * `playwright/test.ts`; callers don't need to pass anything.
   */
  async relaunch(): Promise<void> {
    const { env, playwright } = this._unstash();
    await this._app.close();

    const next = await launchInsomnia(playwright, env as any);
    stashLaunchEnv(next, env, playwright);

    this._app = next;
    this._page = await next.firstWindow({ timeout: 60_000 });
    await this._page.waitForLoadState();
    // Re-seed the konnect PAT like the page fixture does.
    await this._page.evaluate(() => (window as any).main.secretStorage.setSecret('konnectPat', 'kpat_test'));

    this._initPageObjects();
  }

  /**
   * Launch a second Electron instance with a fresh data path and optional env
   * overrides (e.g. a different INSOMNIA_SESSION for a different user).  The
   * returned InsomniaApp is independent — it has its own page and app references
   * and will be cleaned up by the `app` fixture's liveApps teardown.
   */
  async launchClone(newDataPath: string, envOverrides: Record<string, string> = {}): Promise<InsomniaApp> {
    const { env, playwright } = this._unstash();
    const cloneEnv = { ...env, INSOMNIA_DATA_PATH: newDataPath, ...envOverrides };

    const next = await launchInsomnia(playwright, cloneEnv as any);
    stashLaunchEnv(next, cloneEnv, playwright);

    const page = await next.firstWindow({ timeout: 60_000 });
    await page.waitForLoadState();
    await page.evaluate(() => (window as any).main.secretStorage.setSecret('konnectPat', 'kpat_test'));

    return new InsomniaApp(page, next);
  }
}
