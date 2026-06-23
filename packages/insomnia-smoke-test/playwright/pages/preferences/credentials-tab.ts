import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { BasePage } from '../base-page';

/**
 * Component for the **Credentials tab** within Insomnia Preferences.
 *
 * Handles credential management functionality:
 * - Add, edit, and remove credentials
 */
export class PreferencesCredentialsTab extends BasePage {
  constructor(
    readonly page: Page,
    readonly app: ElectronApplication,
  ) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('credentials-settings-tab');
  }

  async addAccessTokenGitCredential() {
    await this.page.getByRole('button', { name: 'Create Git Credential' }).click();
    await this.page.getByText('Access Token').click();
    await this.page.getByRole('textbox', { name: 'Author Email' }).click();
    await this.page.getByRole('textbox', { name: 'Author Email' }).fill('a@b.com');
    await this.page.getByRole('textbox', { name: 'Author Name' }).click();
    await this.page.getByRole('textbox', { name: 'Author Name' }).fill('author');
    await this.page.getByRole('textbox', { name: 'Username' }).click();
    await this.page.getByRole('textbox', { name: 'Username' }).fill('username');
    await this.page.getByRole('textbox', { name: 'Git Access Token' }).click();
    await this.page.getByRole('textbox', { name: 'Git Access Token' }).fill('accesstoken');
    await this.page.getByRole('textbox', { name: 'Repository base URL' }).click();
    await this.page.getByRole('textbox', { name: 'Repository base URL' }).fill('http://localhost:4010/git/');
    await this.page.getByRole('button', { name: 'Save Credential' }).click();
  }
}
