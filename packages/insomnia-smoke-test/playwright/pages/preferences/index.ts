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
   * Opens a specific tab in the preferences modal.
   * @param tabName - The name of the tab to open (e.g., 'Data', 'General', 'Themes')
   */
  async switchToPreferenceTab(tabName: PreferencesTab): Promise<void> {
    await this.root.getByRole('tab', { name: tabName }).click();
  }

  /**
   * Closes the preferences modal.
   */
  async closePreferences(): Promise<void> {
    await this.page.locator('.app').press('Escape');
    await this.root.waitFor({ state: 'hidden' });
  }
}
