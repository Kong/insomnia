import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { PreferencesTabComponent } from "./preferences-tab.component";

/**
 * The Preferences dialog's Plugins and Scripting tabs: plugin install /
 * generate / reload, and the template-tag and script sandbox switches.
 */
export class PreferencesPluginsComponent extends PreferencesTabComponent {
  /**
   * Switches the open Preferences dialog to the Scripting tab, where the
   * template-tag sandbox toggle and per-rule-group sandbox switches live.
   */
  async openScriptingTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "Scripting" }).click();
  }

  /**
   * A custom-styled switch (Scripting tab, Settings.pluginSandboxEnabled)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target. Reading the input's checked
   * state immediately after the click can still report the pre-click
   * value, so this polls until it settles (same race as
   * `TemplateTagPage.setAlgorithm()`).
   */
  async setTemplateTagSandbox(enabled: boolean): Promise<void> {
    const label = this.dialog.getByTestId("toggle-plugin-sandbox");
    const input = label.locator('input[type="checkbox"]');
    if ((await input.isChecked()) !== enabled) {
      await label.click();
      await expect(input).toBeChecked({
        checked: enabled,
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }
}
