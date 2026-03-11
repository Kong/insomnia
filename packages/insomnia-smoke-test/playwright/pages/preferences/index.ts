import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { PreferencesDataTab } from './data-tab';

/**
 * Page Object for **Insomnia Preferences** modal.
 *
 * Composes preference tabs:
 * - Data tab (import/export)
 * - Other tabs (themes, plugins, etc.) can be added as needed
 */
export class PreferencesPage {
  /** Data tab (import/export functionality). */
  readonly dataTab: PreferencesDataTab;

  constructor(
    readonly page: Page,
    readonly app: ElectronApplication
  ) {
    this.dataTab = new PreferencesDataTab(page, app);
  }

  /** The root preferences dialog. */
  get root(): Locator {
    return this.page.locator('text=Insomnia Preferences').first();
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  /**
   * Opens Insomnia Preferences via the statusbar preferences button.
   */
  async openPreferences(): Promise<void> {
    await this.page.getByTestId('settings-button').click();
  }

  /**
   * Closes the preferences modal.
   */
  async closePreferences(): Promise<void> {
    await this.page.locator('.app').press('Escape');
  }
}
