import type { ScriptSandboxRuleGroup } from "@package/enums/script-sandbox-rule-group";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { PreferencesTabComponent } from "./preferences-tab.component";

export interface PluginBridgeMethodMetrics {
  ok: number;
  error: number;
  timeout: number;
}

export interface PluginBridgeMetrics {
  windowStartups: number;
  windowCrashes: number;
  pendingInvocations: number;
  perMethod: Record<string, PluginBridgeMethodMetrics>;
}

export interface BundlePluginInfo {
  name: string;
  description: string;
  version: string;
  directory: string;
  config: { disabled: boolean };
  permissions: { modules: string[]; capabilities: string[] };
  permissionWarnings: string[];
  permissionsDeclared: boolean;
}

/**
 * The Preferences dialog's Plugins and Scripting tabs: plugin install /
 * generate / reload, and the template-tag and script sandbox switches.
 */
export class PreferencesPluginsComponent extends PreferencesTabComponent {
  /**
   * Switches the open Preferences dialog to the Plugins tab, where plugins
   * are installed, generated, and reloaded from disk.
   */
  async openPluginsTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "Plugins" }).click();
  }

  /**
   * Switches the open Preferences dialog to the Scripting tab, where the
   * template-tag sandbox toggle and per-rule-group sandbox switches live.
   */
  async openScriptingTab(): Promise<void> {
    await this.tabs.tabByName("Scripting").click();
  }

  /**
   * Opens the "New Plugin" modal from the Plugins tab, which must already
   * be open (see `openPluginsTab()`).
   */
  async openNewPlugin(): Promise<void> {
    await this.dialog.getByRole("button", { name: "New Plugin" }).click();
    await expect(this.page.getByTestId("plugin-name-input")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Fills the "New Plugin" modal's name field — just the suffix that
   * follows the fixed `insomnia-plugin-` prefix shown beside the input
   * (the input itself only holds the suffix).
   */
  async setNewPluginName(name: string): Promise<void> {
    await this.page.getByTestId("plugin-name-input").fill(name);
  }

  /**
   * Clicks "Generate" in the open "New Plugin" modal. On success the modal
   * closes; on a validation failure it stays open with an error message
   * (see `getNewPluginNameError()`).
   */
  async clickGenerateNewPlugin(): Promise<void> {
    await this.page.getByTestId("generate-plugin-button").click();
  }

  /**
   * Reads the "New Plugin" modal's name-validation error text. Confirmed
   * live: this element is always present with a static format hint
   * (`"Plugin name must be of format my-plugin-name"`) before any submit
   * attempt, and switches to a specific message (e.g. path-traversal) once
   * "Generate" is clicked with an invalid name.
   *
   * Called only after `isNewPluginModalOpen()` reports the modal open, but
   * that check races a just-accepted name's modal auto-closing — this
   * element can vanish between the two calls. A short explicit timeout
   * (rather than the default) makes that loss fail fast into the caller's
   * `toPass()` retry instead of blocking it for the full default timeout.
   */
  private async getNewPluginNameError(): Promise<string> {
    return (
      (await this.page
        .getByTestId("plugin-name-error")
        .textContent({ timeout: 1000 })) ?? ""
    );
  }

  /**
   * Reports whether the "New Plugin" modal is still open — `false` means
   * the most recent "Generate" click succeeded and the modal closed itself.
   */
  private async isNewPluginModalOpen(): Promise<boolean> {
    return this.page.getByTestId("plugin-name-input").isVisible();
  }

  /**
   * Waits for a just-clicked "Generate" to resolve to its final outcome —
   * either the modal closing on its own (name accepted) or the error field
   * settling on a specific message (name rejected). Reading
   * the error field immediately after clicking can still show the
   * pre-submit static format hint (`"Plugin name must be of format
   * my-plugin-name"`), so this polls past that hint rather than racing it.
   */
  async waitForNewPluginOutcome(): Promise<string | null> {
    let error: string | null = null;
    await expect(async () => {
      if (!(await this.isNewPluginModalOpen())) {
        error = null;
        return;
      }
      const current = await this.getNewPluginNameError();
      expect(current).not.toBe("Plugin name must be of format my-plugin-name");
      error = current;
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return error;
  }

  /**
   * Closes the "New Plugin" modal via Escape, without closing Preferences
   * itself — unlike every other modal in this app, its own
   * close button carries no accessible name ("Modal Close Button" only
   * matches the underlying Preferences dialog's), so a role-based click
   * would hit the wrong element. A no-op if the modal already closed on
   * its own (e.g. after a successful "Generate").
   */
  async closeNewPluginModal(): Promise<void> {
    if (!(await this.isNewPluginModalOpen())) return;
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByTestId("plugin-name-input")).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads the full `insomnia-plugin-*` names currently listed on the
   * Plugins tab, which must already be open (see `openPluginsTab()`).
   * Each row's `data-testid` is the plugin name itself,
   * but the row's own text content runs the name straight into its
   * permissions/version text with no separator, so the name is parsed
   * back out of the `data-testid` attribute instead of the rendered text.
   */
  async getPluginNames(): Promise<string[]> {
    const rows = this.dialog.locator('[data-testid^="insomnia-plugin-"]');
    const testIds = await rows.evaluateAll((els) =>
      els.map((el) => el.dataset.testid),
    );
    return testIds.filter((id): id is string => id !== null);
  }

  /**
   * Re-scans the app's `plugins/` data directory and reloads every plugin
   * found there — including ones written directly to disk (e.g. via `fs`
   * against `AppFlow.getDataPath()`) rather than through the "New Plugin"/
   * "Install Plugin" UI. Does not require the Preferences dialog to be
   * open.
   */
  async reloadPlugins(): Promise<void> {
    await this.page.evaluate(() =>
      (window as any).main.plugins.reloadPlugins(),
    );
  }

  /**
   * Reads the currently-registered template tag names (built-in and
   * plugin-provided) via the plugin bridge. Does not require the
   * Preferences dialog to be open.
   */
  async getRegisteredTemplateTagNames(): Promise<string[]> {
    return this.page.evaluate(async () =>
      (await (window as any).main.plugins.getTemplateTags()).map(
        (t: any) => t?.templateTag?.name ?? t?.name,
      ),
    );
  }

  /**
   * Reads the plugin bridge's own diagnostic counters (per-method
   * ok/error/timeout counts and durations) from the hidden plugin
   * `BrowserWindow`. Does not require the Preferences dialog to be open.
   */
  async getPluginBridgeMetrics(): Promise<PluginBridgeMetrics> {
    return this.page.evaluate(() =>
      (window as any).main.plugins.getBridgeMetrics(),
    );
  }

  /**
   * Reads the app's bundled (built-in, non-user-installed) plugins via
   * the plugin bridge, which returns
   * `@kong/insomnia-plugin-external-vault` and `@kong/insomnia-plugin-ai`
   * for this project's fixture, distinct from `getPluginNames()`'s list
   * (which only reflects user-installed plugins shown on the Plugins
   * tab). Does not require the Preferences dialog to be open.
   *
   * Each entry's `permissions`/`permissionWarnings`/`permissionsDeclared`
   * fields are purely descriptive metadata read back from the plugin's
   * own manifest — they have no effect on what the
   * plugin can actually do at runtime (an undeclared native module
   * require still succeeds, and `permissionWarnings` never populates
   * regardless of what's declared), so don't test them as an enforced
   * security boundary.
   */
  async getBundlePlugins(): Promise<BundlePluginInfo[]> {
    return this.page.evaluate(() =>
      (window as any).main.plugins.getBundlePlugins(),
    );
  }

  /**
   * Runs a plugin-provided request action by its declared `label` through
   * the plugin bridge — `executeAction()` requires a
   * `type: "request"` field merged into the action object returned by
   * `getRequestActions()`, which doesn't carry one itself. Rejects with the
   * action's own thrown/rejected error, if any.
   */
  async executeRequestAction(label: string, requestId: string): Promise<void> {
    await this.page.evaluate(
      async ([actionLabel, id]) => {
        const actions = await (window as any).main.plugins.getRequestActions();
        const target = actions.find((a: any) => a?.label === actionLabel);
        if (!target)
          throw new Error(
            `No request action labeled "${actionLabel}" is registered`,
          );
        await (window as any).main.plugins.executeAction(
          { ...target, type: "request" },
          { activeRequest: { _id: id } },
        );
      },
      [label, requestId] as [string, string],
    );
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

  /**
   * Toggles the Scripting tab's per-rule-group sandbox switch for a given
   * group (e.g. "Scopes", "Prototype Mutation"), located by the
   * `script-sandbox-group-<slug>` test id so same-named substrings in
   * sibling groups (e.g. "Node.js Internals" vs. "Global & Node.js
   * Internals") never collide. The switch is itself a label-wraps-checkbox
   * control, same clickable-target quirk as `setTemplateTagSandbox()`.
   */
  async setScriptSandboxRule(
    group: ScriptSandboxRuleGroup,
    enabled: boolean,
  ): Promise<void> {
    const label = this.getScriptSandboxRuleLabel(group);
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
   * Reads the Scripting tab's per-rule-group sandbox switch's current
   * state.
   */
  async isScriptSandboxRuleEnabled(
    group: ScriptSandboxRuleGroup,
  ): Promise<boolean> {
    return this.getScriptSandboxRuleLabel(group)
      .locator('input[type="checkbox"]')
      .isChecked();
  }

  private getScriptSandboxRuleLabel(group: ScriptSandboxRuleGroup) {
    return this.dialog.getByTestId(
      `script-sandbox-group-${group.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    );
  }
}
