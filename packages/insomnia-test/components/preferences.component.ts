import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { PreferencesTabComponent } from "./preferences-tab.component";

/**
 * The Preferences dialog itself (open / close) and its General, Data and
 * Proxy tabs. Other tabs live in `PreferencesCredentialsComponent`,
 * `PreferencesPluginsComponent`, `PreferencesAiComponent` and `PreferencesVaultComponent`.
 */
export class PreferencesComponent extends PreferencesTabComponent {
  /**
   * Closes the Preferences dialog via its close button and waits for it
   * to be hidden. More reliable than Escape, whose dismiss behavior can be
   * disrupted by a just-closed nested modal (e.g. the Add Credential
   * dialog) leaving focus in an unexpected place.
   */
  async close(): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Modal Close Button" })
      .click();
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the Preferences dialog via its trigger button and waits for it
   * to appear.
   */
  async open(): Promise<void> {
    await this.page.getByTestId("settings-button").click();
    await this.waitUntilOpen();
  }

  /**
   * A custom-styled checkbox (General tab, Settings.validateSSL) whose
   * native input ignores direct clicks — the wrapping label is the actual
   * clickable target.
   */
  async setValidateSSL(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("setting-validateSSL");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * A custom-styled checkbox (General tab, Settings.sidebarFocusForCollections)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target. Same shape as setValidateSSL() above.
   */
  async setSidebarFocusForCollections(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("setting-sidebarFocusForCollections");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * A custom-styled checkbox (General tab, Settings.showLegacyUnitTests)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target. Same shape as setValidateSSL() above. Gates
   * the Tests tab (`WorkspacePage.openTestsTab()`) on an API Collection —
   * The legacy unit-test viewer is hidden by default.
   */
  async setShowLegacyUnitTests(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("setting-enableLegacyUnitTests");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * Adds `path` to "What folders can Insomnia access?" (General tab), so
   * scripts/template tags can read files under it. Fills the text input
   * and clicks "Add", then waits for it to appear in the folder list.
   */
  async addDataFolder(path: string): Promise<void> {
    await this.dialog.locator('input[data-testid="dataFolders"]').fill(path);
    await this.dialog.locator('button[data-testid="dataFolders-btn"]').click();
    await expect(this.dialog.getByRole("option", { name: path })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Switches the open Preferences dialog to the Proxy tab.
   */
  async openProxyTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "Proxy" }).click();
  }

  /**
   * A custom-styled checkbox (Proxy tab, Settings.proxyEnabled) whose
   * native input ignores direct clicks — the wrapping label is the actual
   * clickable target, same quirk as `setValidateSSL()`. Must be called
   * with `openProxyTab()` already open.
   */
  async setProxyEnabled(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("setting-proxyEnabled");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * Fills the Proxy tab's "Proxy for HTTP" field. Must be called with
   * `openProxyTab()` already open.
   */
  async setHttpProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="httpProxy"]').fill(value);
  }

  /**
   * Fills the Proxy tab's "Proxy for HTTPS" field. Must be called with
   * `openProxyTab()` already open.
   */
  async setHttpsProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="httpsProxy"]').fill(value);
  }

  /**
   * Fills the Proxy tab's "No proxy" field. Must be called with
   * `openProxyTab()` already open.
   */
  async setNoProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="noProxy"]').fill(value);
  }

  /**
   * A custom-styled checkbox (General tab,
   * Settings.hideSecretValuesInPreviewAndConsole) whose native input
   * ignores direct clicks — the wrapping label is the actual clickable
   * target. Toggling it in either direction pops an informational alert
   * ("Hiding Confidential Variables" / "Confidential Variables Are Now
   * Visible"), which is dismissed here so it doesn't block later steps.
   * On by default, which masks vault/secret values in the template tag
   * Live Preview as `••••••`.
   */
  async setHideSecretValuesInPreviewAndConsole(
    enabled: boolean,
  ): Promise<void> {
    const label = this.dialog.getByTestId("setting-hideSecretValuesInPreviewAndConsole");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
      const alert = this.page
        .getByRole("dialog")
        .filter({ hasText: /Confidential Variables/ });
      await alert.getByRole("button", { name: "Ok" }).click();
      await expect(alert).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    }
  }

  /**
   * A custom-styled checkbox (General tab, Settings.filterResponsesByEnv)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target, same quirk as `setValidateSSL()`.
   */
  async setFilterResponsesByEnvironment(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("setting-filterResponsesByEnv");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * Fills the General tab's "Request timeout (ms)" field.
   */
  async setRequestTimeout(ms: number): Promise<void> {
    await this.page.getByLabel("Request timeout (ms)").fill(String(ms));
  }
}
