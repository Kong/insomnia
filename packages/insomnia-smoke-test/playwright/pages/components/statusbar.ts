import type { Locator, Page } from '@playwright/test';

/**
 * Component for the **statusbar** (footer bar at bottom of app).
 *
 * Always visible across all pages (except login splash).
 * Contains:
 * - Preferences button (gear icon)
 * - Network indicator
 * - Sidebar/header toggle buttons
 */
export class StatusbarComponent {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId('statusbar');
  }

  /** Open Insomnia Preferences via the statusbar preferences button. */
  async openPreferences() {
    await this.root.getByTestId('settings-button').click();
  }

  /** Open Insomnia Preferences via keyboard shortcut. */
  async openPreferencesViaShortcut() {
    const modifier = process.platform === 'darwin' ? 'Meta+,' : 'Control+,';
    await this.page.press('body', modifier);
  }
}
