import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { PreferencesDataTab } from './data-tab';

type PreferencesTab = 'Data' | 'General' | 'Themes' | 'Plugins' | 'Other';

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
    readonly app: ElectronApplication,
  ) {
    this.dataTab = new PreferencesDataTab(page, app);
  }

  /** The root preferences dialog. */
  get root(): Locator {
    return this.page.getByTestId('preference-modal');
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  /**
   * Opens Insomnia Preferences via the statusbar preferences button.
   */
  async openPreferences(tab?: PreferencesTab): Promise<void> {
    await this.page.getByTestId('settings-button').click();
    if (tab) {
      await this.openTab(tab);
    }
  }

  /**
   * Opens a specific tab in the preferences modal.
   * @param tabName - The name of the tab to open (e.g., 'Data', 'General', 'Themes')
   */
  async openTab(tabName: PreferencesTab): Promise<void> {
    await this.page.getByRole('tab', { name: tabName }).click();
  }

  /**
   * Closes the preferences modal.
   */
  async closePreferences(): Promise<void> {
    await this.page.locator('.app').press('Escape');
  }
}
