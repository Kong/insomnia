import { expect } from "@playwright/test";

import type { ScriptSandboxRuleGroup } from "../enums/script-sandbox-rule-group";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type { GitCredential } from "../models/git-credential";
import type { CloudCredential } from "../models/settings";
import { BasePage } from "./base.page";

type AwsCloudCredential = Extract<CloudCredential, { provider: "aws" }>;
type GcpCloudCredential = Extract<CloudCredential, { provider: "gcp" }>;
type HashiCorpCloudCredential = Extract<
  CloudCredential,
  { provider: "hashicorp" }
>;

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

export interface LlmUrlBackendFormFields {
  url: string;
  model: string;
  apiKey: string;
  temperature: string;
  topP: string;
  maxTokens: string;
}

export class PreferencesPage extends BasePage {
  private readonly dialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Insomnia Preferences" });

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
   * Reports whether the Preferences dialog is currently open. Some
   * actions taken from within it (e.g. a multi-file export's completion)
   * close it as a side effect, so callers that always invoke `close()`
   * afterward should check this first rather than assume it's still open.
   */
  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /**
   * Confirms the Preferences dialog is open by waiting for it to become
   * visible.
   */
  async navigate(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the Preferences dialog via its trigger button and waits for it
   * to appear.
   */
  async open(): Promise<void> {
    await this.page.getByRole("button", { name: "Preferences" }).click();
    await this.navigate();
  }

  /**
   * A custom-styled checkbox (General tab, Settings.validateSSL) whose
   * native input ignores direct clicks — the wrapping label is the actual
   * clickable target.
   * @param enabled - Whether SSL certificate validation should be enabled
   */
  async setValidateSSL(enabled: boolean): Promise<void> {
    const label = this.dialog.locator("label", {
      hasText: /^Validate certificates$/,
    });
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
   * @param enabled - Whether the sidebar should narrow to a collection's contents once it's focused
   */
  async setSidebarFocusForCollections(enabled: boolean): Promise<void> {
    const label = this.dialog.locator("label", {
      hasText: /^Sidebar focus for collections$/,
    });
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
   * Reads whether the General tab's "Sidebar focus for collections"
   * checkbox is currently checked.
   */
  async isSidebarFocusForCollectionsEnabled(): Promise<boolean> {
    const label = this.dialog.locator("label", {
      hasText: /^Sidebar focus for collections$/,
    });
    return label.locator('input[type="checkbox"]').isChecked();
  }

  /**
   * A custom-styled checkbox (General tab, Settings.showLegacyUnitTests)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target. Same shape as setValidateSSL() above. Gates
   * the Tests tab (`WorkspacePage.openTestsTab()`) on an API Collection —
   * INS-3528 hides the legacy unit-test viewer by default.
   * @param enabled - Whether the legacy unit-test viewer should be shown
   */
  async setShowLegacyUnitTests(enabled: boolean): Promise<void> {
    const label = this.dialog.locator("label", {
      hasText: /^Show legacy unit tests$/,
    });
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
   * Reads whether the General tab's "Show legacy unit tests" checkbox is
   * currently checked.
   */
  async isShowLegacyUnitTestsEnabled(): Promise<boolean> {
    const label = this.dialog.locator("label", {
      hasText: /^Show legacy unit tests$/,
    });
    return label.locator('input[type="checkbox"]').isChecked();
  }

  /**
   * Switches the open Preferences dialog to the Credentials tab, where Git
   * credentials are added/managed.
   */
  async openCredentialsTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "Credentials" }).click();
  }

  /**
   * Switches the open Preferences dialog to the Data tab, where the
   * Export/Import shortcuts live.
   */
  async openDataTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "Data" }).click();
  }

  /**
   * Clicks "Export all data (N files)" on the Data tab, which bundles
   * every project into a directory (one file per workspace) without
   * a request-selection or format-selection step. Must be called with
   * `openDataTab()` already open and the target save directory already
   * stubbed via `ExportPage.stubSaveDirectoryLocation()`.
   */
  async clickExportAllData(): Promise<void> {
    await this.dialog
      .getByRole("button")
      .filter({ hasText: /^Export all data/ })
      .click();
  }

  /**
   * Clicks "Export the "{name}" Project" on the Data tab. Skips the
   * request-selection dialog and opens "Select Export Type" directly
   * (see `ExportPage`).
   * @param name - The Project's display name
   */
  async clickExportProject(name: string): Promise<void> {
    await this.dialog
      .getByRole("button")
      .filter({ hasText: new RegExp(`^Export.*"${name}" Project$`) })
      .click();
  }

  /**
   * Adds `path` to "What folders can Insomnia access?" (General tab), so
   * scripts/template tags can read files under it. Fills the text input
   * and clicks "Add", then waits for it to appear in the folder list.
   * @param path - The absolute folder path to allow
   */
  async addDataFolder(path: string): Promise<void> {
    await this.dialog.locator('input[data-testid="dataFolders"]').fill(path);
    await this.dialog.locator('button[data-testid="dataFolders-btn"]').click();
    await expect(this.dialog.getByRole("option", { name: path })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Adds a custom (username/PAT) Git credential from the Credentials tab,
   * which must already be open (see `openCredentialsTab()`).
   * @param credential - The custom credential to add
   */
  async addCustomCredential(credential: GitCredential): Promise<void> {
    const modal = this.page.getByRole("dialog", {
      name: /Access Token Credential/,
    });
    await this.dialog
      .getByRole("button", { name: "Create Git Credential" })
      .click();
    await this.page.getByText("Access Token", { exact: true }).click();
    await this.page.getByLabel("Author Email").fill(credential.authorEmail);
    await this.page.getByLabel("Author Name").fill(credential.authorName);
    await this.page.getByLabel("Username").fill(credential.username);
    await this.page.getByLabel("Git Access Token").fill(credential.password);
    await this.page.getByRole("button", { name: "Save Credential" }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Adds an AWS cloud (vault) credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — selects the "Credential File" credential
   * type, matching the enterprise-plan-gated `@kong/insomnia-plugin-
   * external-vault` bundle plugin's own smoke-tested flow: under this
   * app's `PLAYWRIGHT=true` launch env, the plugin's `authenticate` action
   * short-circuits to a canned success without ever calling AWS STS, so
   * `credentials.section`/`.region` need only be well-formed strings, not
   * real AWS values.
   * @param credential - The AWS credential's display name, section name, and region
   */
  async createAwsCloudCredential(
    credential: Omit<AwsCloudCredential, "provider">,
  ): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Create Cloud Credential" })
      .click();
    await this.page.getByRole("menuitemradio", { name: "AWS" }).click();
    const modal = this.page.getByRole("dialog", {
      name: /Authenticate With AWS/,
    });
    await modal
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal.getByRole("radio", { name: "Credential File" }).check();
    await modal
      .getByRole("textbox", { name: "Section Name:" })
      .fill(credential.credentials.section);
    await modal
      .getByRole("textbox", { name: "Region:" })
      .fill(credential.credentials.region);
    await modal.getByRole("button", { name: "Create", exact: true }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Adds a GCP cloud (vault) credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — same `PLAYWRIGHT=true` bypass as
   * `createAwsCloudCredential()`, so `credentials.serviceAccountKeyFilePath`
   * need only be a non-empty string (the Create button stays disabled
   * while it's empty), not a real service account key file.
   * @param credential - The GCP credential's display name and service account key path
   */
  async createGcpCloudCredential(
    credential: Omit<GcpCloudCredential, "provider">,
  ): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Create Cloud Credential" })
      .click();
    await this.page.getByRole("menuitemradio", { name: "GCP" }).click();
    const modal = this.page.getByRole("dialog", {
      name: /Authenticate With GCP/,
    });
    await modal
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal
      .getByRole("textbox", { name: "Input Service Account Key Path" })
      .fill(credential.credentials.serviceAccountKeyFilePath);
    await modal.getByRole("button", { name: "Create", exact: true }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Adds a HashiCorp Vault cloud credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — leaves System Type/Auth Method on their
   * defaults (On-Premises/AppRole). Same `PLAYWRIGHT=true` bypass as
   * `createAwsCloudCredential()`, so `credentials.serverAddress` need only
   * be a well-formed URL (validated live, client-side) and
   * `credentials.role_id`/`.secret_id` need only be non-empty — the real
   * AppRole login call never happens.
   * @param credential - The HashiCorp credential's display name, server address, role id, and secret id
   */
  async createHashiCorpCloudCredential(
    credential: Omit<HashiCorpCloudCredential, "provider">,
  ): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Create Cloud Credential" })
      .click();
    await this.page.getByRole("menuitemradio", { name: "HashiCorp" }).click();
    const modal = this.page.getByRole("dialog", {
      name: /Authenticate With HashiCorp/,
    });
    await modal
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal
      .getByRole("textbox", { name: "Server Address:" })
      .fill(credential.credentials.serverAddress);
    await modal
      .getByRole("textbox", { name: "Role Id:" })
      .fill(credential.credentials.role_id);
    await modal
      .getByRole("textbox", { name: "Secret Id:" })
      .fill(credential.credentials.secret_id);
    await modal.getByRole("button", { name: "Create", exact: true }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

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
    await this.dialog.getByRole("tab", { name: "Scripting" }).click();
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
   * (confirmed live: the input itself only holds the suffix).
   * @param name - The plugin name's suffix, e.g. `"my-plugin"` for `insomnia-plugin-my-plugin`
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
   * @returns The error/hint text currently shown
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
   * settling on a specific message (name rejected). Confirmed live: reading
   * the error field immediately after clicking can still show the
   * pre-submit static format hint (`"Plugin name must be of format
   * my-plugin-name"`), so this polls past that hint rather than racing it.
   * @returns The validation error message, or `null` if the name was accepted
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
   * itself — confirmed live: unlike every other modal in this app, its own
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
   * Confirmed live: each row's `data-testid` is the plugin name itself,
   * but the row's own text content runs the name straight into its
   * permissions/version text with no separator, so the name is parsed
   * back out of the `data-testid` attribute instead of the rendered text.
   * @returns The registered plugin names, in list order
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
   * @returns The registered template tag names
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
   * @returns The current bridge metrics snapshot
   */
  async getPluginBridgeMetrics(): Promise<PluginBridgeMetrics> {
    return this.page.evaluate(() =>
      (window as any).main.plugins.getBridgeMetrics(),
    );
  }

  /**
   * Reads the app's bundled (built-in, non-user-installed) plugins via
   * the plugin bridge — confirmed live to return
   * `@kong/insomnia-plugin-external-vault` and `@kong/insomnia-plugin-ai`
   * for this project's fixture, distinct from `getPluginNames()`'s list
   * (which only reflects user-installed plugins shown on the Plugins
   * tab). Does not require the Preferences dialog to be open.
   *
   * Each entry's `permissions`/`permissionWarnings`/`permissionsDeclared`
   * fields are purely descriptive metadata read back from the plugin's
   * own manifest — confirmed live that they have no effect on what the
   * plugin can actually do at runtime (an undeclared native module
   * require still succeeds, and `permissionWarnings` never populates
   * regardless of what's declared), so don't test them as an enforced
   * security boundary.
   * @returns The bundled plugins currently loaded
   */
  async getBundlePlugins(): Promise<BundlePluginInfo[]> {
    return this.page.evaluate(() =>
      (window as any).main.plugins.getBundlePlugins(),
    );
  }

  /**
   * Runs a plugin-provided request action by its declared `label` through
   * the plugin bridge — confirmed live: `executeAction()` requires a
   * `type: "request"` field merged into the action object returned by
   * `getRequestActions()`, which doesn't carry one itself. Rejects with the
   * action's own thrown/rejected error, if any.
   * @param label - The request action's declared label
   * @param requestId - The `_id` of the request to run the action against
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
   * A custom-styled switch (Scripting tab, Settings.templateTagSandboxEnabled)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target. Confirmed live: reading the input's checked
   * state immediately after the click can still report the pre-click
   * value, so this polls until it settles (same race as
   * `TemplateTagPage.setAlgorithm()`).
   * @param enabled - Whether plugin template tags should run inside the QuickJS sandbox
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
   * Toggles the Scripting tab's per-rule-group sandbox switch beside a
   * given `<h4>` heading (e.g. "Scopes", "Prototype Mutation") — confirmed
   * live selector shape: `div:has(> h4:text-is(...))` scoped to that
   * heading's own row so same-named substrings in sibling headings (e.g.
   * "Node.js Internals" vs. "Global & Node.js Internals") never collide.
   * The row's switch is itself a label-wraps-checkbox control, same
   * clickable-target quirk as `setTemplateTagSandbox()`.
   * @param group - The rule group to toggle
   * @param enabled - Whether the rule group should be enabled
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
   * @param group - The rule group to read
   * @returns Whether the rule group is currently enabled
   */
  async isScriptSandboxRuleEnabled(
    group: ScriptSandboxRuleGroup,
  ): Promise<boolean> {
    return this.getScriptSandboxRuleLabel(group)
      .locator('input[type="checkbox"]')
      .isChecked();
  }

  private getScriptSandboxRuleLabel(group: ScriptSandboxRuleGroup) {
    return this.dialog
      .locator(`div:has(> h4:text-is("${group}"))`)
      .locator("label[data-react-aria-pressable]");
  }

  /**
   * Switches the open Preferences dialog to the "AI Settings" tab. Only
   * rendered once the bundled AI plugin is present and the user is logged
   * in — confirmed live to always be true for this project's fixture.
   */
  async openAiSettingsTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "AI Settings" }).click();
  }

  /**
   * Clicks a backend's nav button on the AI Settings tab (e.g. `"LLM URL"`,
   * or `"LLM URL Active"` once it's the active backend) to expand its
   * config panel. Must be called with `openAiSettingsTab()` already open.
   * @param name - The button's exact accessible name
   */
  async clickAiBackendNav(name: string): Promise<void> {
    await this.dialog.getByRole("button", { name }).click();
  }

  /**
   * Reports whether a backend's nav button currently carries the "Active"
   * badge (i.e. it's the app's current LLM backend). Must be called with
   * `openAiSettingsTab()` already open.
   * @param navLabel - The backend's un-suffixed nav label, e.g. `"LLM URL"`
   */
  async isAiBackendActive(navLabel: string): Promise<boolean> {
    return this.dialog
      .getByRole("button", { name: `${navLabel} Active` })
      .isVisible();
  }

  /**
   * Fills the "url" backend panel's "LLM URL" field. Must be called with
   * the panel already expanded (see `clickAiBackendNav()`).
   * @param url - The LLM endpoint URL
   */
  async setAiUrlBackendUrl(url: string): Promise<void> {
    await this.page.getByLabel("LLM URL").fill(url);
  }

  /**
   * Fills the "url" backend panel's "API Token" field. Must be called with
   * the panel already expanded (see `clickAiBackendNav()`).
   * @param token - The bearer token to send with requests to the LLM endpoint
   */
  async setAiUrlBackendApiToken(token: string): Promise<void> {
    await this.page.getByLabel("API Token").fill(token);
  }

  /**
   * Clicks "Load Models" on the "url" backend panel — fetches
   * `<url>/models` for real and waits for the resulting "Model" dropdown
   * to appear. Must be called with `setAiUrlBackendUrl()` already filled.
   */
  async clickLoadAiModels(): Promise<void> {
    await this.page.getByRole("button", { name: "Load Models" }).click();
    await expect(this.page.getByLabel("Model")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Selects a model from the "url" backend panel's "Model" dropdown, once
   * populated (see `clickLoadAiModels()`).
   * @param modelId - The model id to select, as returned by `<url>/models`
   */
  async selectAiModel(modelId: string): Promise<void> {
    await this.page.getByLabel("Model").selectOption(modelId);
  }

  /**
   * Ensures the "Model" `<select>` is on screen, clicking whichever button
   * currently fetches it. Confirmed live: an already-active backend that
   * hasn't had "Load Models" clicked in this render pass shows a plain
   * "Active model: <name>" text row with a "Change" button instead of the
   * `<select>` — both trigger the same re-fetch, so either one converges
   * on the same dropdown.
   */
  private async ensureModelSelectorVisible(): Promise<void> {
    const modelSelect = this.page.getByLabel("Model");
    if (await modelSelect.isVisible()) return;
    const changeButton = this.page.getByRole("button", { name: "Change" });
    await ((await changeButton.isVisible()) ? changeButton.click() : this.page.getByRole("button", { name: "Load Models" }).click());
    await expect(modelSelect).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads a labeled input's current value on the AI Settings tab (e.g.
   * `"LLM URL"`, `"API Token"`, `"Temperature (0-2):"`). Must be called
   * with the relevant backend's panel already expanded (see
   * `clickAiBackendNav()`).
   * @param label - The field's accessible label text
   * @returns The field's current value
   */
  private async getAiSettingsFieldValue(label: string): Promise<string> {
    return this.page.getByLabel(label).inputValue();
  }

  /**
   * Fills a labeled numeric input on the AI Settings tab's expanded
   * Advanced Options panel (e.g. `"Temperature (0-2):"`, `"Top P (0-1):"`,
   * `"Max Tokens (1-128000):"`). Must be called with
   * `openAiAdvancedOptions()` already open.
   * @param label - The field's accessible label text
   * @param value - The value to fill
   */
  async setAiAdvancedOptionValue(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Clicks "Advanced Options" on the AI Settings tab's expanded backend
   * panel to reveal the Temperature/Top P/Max Tokens fields — a no-op if
   * they're already visible. Confirmed live: the Preferences modal isn't
   * remounted on every open/close (local component state, including this
   * toggle, survives), so an unconditional click can collapse an
   * already-open panel instead of opening it.
   */
  async openAiAdvancedOptions(): Promise<void> {
    const alreadyOpen = await this.page
      .getByLabel("Temperature (0-2):")
      .isVisible();
    if (!alreadyOpen) {
      await this.page.getByRole("button", { name: "Advanced Options" }).click();
    }
  }

  /**
   * Expands the "url" backend's panel and reads back every one of its form
   * fields, including Advanced Options — the shape shown is specific to
   * the "url" backend (other backends render different fields). Must be
   * called with `openAiSettingsTab()` already open. Confirmed live: on a
   * fresh mount (e.g. right after reopening Preferences), the panel's own
   * hydration from the app's async-loaded backend config can still be
   * mid-flight the instant this reads — for an already-configured backend
   * the "LLM URL" field is never genuinely blank, so this polls past a
   * transient empty read rather than racing it.
   * @param navLabel - The backend's nav button accessible name, e.g. `"LLM URL"` or `"LLM URL Active"`
   * @returns The backend's current form field values
   */
  async getUrlBackendFormValues(
    navLabel: string,
  ): Promise<LlmUrlBackendFormFields> {
    await this.clickAiBackendNav(navLabel);
    let url = "";
    await expect(async () => {
      url = await this.getAiSettingsFieldValue("LLM URL");
      expect(url).not.toBe("");
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await this.ensureModelSelectorVisible();
    const model = await this.page.getByLabel("Model").inputValue();
    const apiKey = await this.getAiSettingsFieldValue("API Token");
    await this.openAiAdvancedOptions();
    const temperature =
      await this.getAiSettingsFieldValue("Temperature (0-2):");
    const topP = await this.getAiSettingsFieldValue("Top P (0-1):");
    const maxTokens = await this.getAiSettingsFieldValue(
      "Max Tokens (1-128000):",
    );
    return { url, model, apiKey, temperature, topP, maxTokens };
  }

  /**
   * Clicks "Activate" on the "url" backend panel — enabled once a model is
   * selected (see `selectAiModel()`). Persists the config and marks this
   * backend active, all through the real UI (no bridge call involved).
   */
  async clickActivateAiBackend(): Promise<void> {
    await this.page.getByRole("button", { name: "Activate" }).click();
  }

  /**
   * Clicks "Deactivate" on the AI Settings tab's expanded active-backend
   * panel, clearing the active backend without deleting its stored config.
   */
  async clickDeactivateAiBackend(): Promise<void> {
    await this.page.getByRole("button", { name: "Deactivate" }).click();
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
   * @param enabled - Whether the global network proxy should be enabled
   */
  async setProxyEnabled(enabled: boolean): Promise<void> {
    const label = this.dialog.locator("label", {
      hasText: /^Enable proxy$/,
    });
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
   * @param value - The proxy address, e.g. `"127.0.0.1:1111"`
   */
  async setHttpProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="httpProxy"]').fill(value);
  }

  /**
   * Fills the Proxy tab's "Proxy for HTTPS" field. Must be called with
   * `openProxyTab()` already open.
   * @param value - The proxy address, e.g. `"127.0.0.1:2222"`
   */
  async setHttpsProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="httpsProxy"]').fill(value);
  }

  /**
   * Fills the Proxy tab's "No proxy" field. Must be called with
   * `openProxyTab()` already open.
   * @param value - Comma-separated list of hostnames to bypass the proxy for
   */
  async setNoProxy(value: string): Promise<void> {
    await this.dialog.locator('input[name="noProxy"]').fill(value);
  }

  /**
   * A custom-styled checkbox (General tab, Settings.filterResponsesByEnv)
   * whose native input ignores direct clicks — the wrapping label is the
   * actual clickable target, same quirk as `setValidateSSL()`.
   * @param enabled - Whether responses should be filtered to the active environment
   */
  async setFilterResponsesByEnvironment(enabled: boolean): Promise<void> {
    const label = this.dialog.locator("label", {
      hasText: /^Filter responses by environment$/,
    });
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
   * Reads whether the General tab's "Filter responses by environment"
   * checkbox is currently checked.
   */
  async isFilterResponsesByEnvironmentEnabled(): Promise<boolean> {
    const label = this.dialog.locator("label", {
      hasText: /^Filter responses by environment$/,
    });
    return label.locator('input[type="checkbox"]').isChecked();
  }

  /**
   * Fills the General tab's "Request timeout (ms)" field.
   * @param ms - The timeout in milliseconds; `0` disables timeouts
   */
  async setRequestTimeout(ms: number): Promise<void> {
    await this.page.getByLabel("Request timeout (ms)").fill(String(ms));
  }

  /**
   * Clicks "Generate Vault Key" (General tab, Security section) and waits
   * for the freshly-generated key to render. Only shown when no vault salt
   * exists yet for this session — see `openEnterVaultKeyModal()` for the
   * already-salted case.
   * @returns The generated vault key's displayed value
   */
  async generateVaultKey(): Promise<string> {
    await this.dialog
      .getByRole("button", { name: "Generate Vault Key" })
      .click();
    const panel = this.dialog.getByTestId("VaultKeyDisplayPanel");
    let value = "";
    await expect(async () => {
      value = (await panel.innerText()).trim();
      expect(value.length).toBeGreaterThan(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return value;
  }

  /**
   * Reads the General tab's currently-displayed vault key, once already
   * unlocked (see `generateVaultKey()`/`enterVaultKey()`).
   */
  async getVaultKey(): Promise<string> {
    return (
      await this.dialog.getByTestId("VaultKeyDisplayPanel").innerText()
    ).trim();
  }

  /**
   * Clicks "Enter Vault Key" (General tab, Security section) and waits for
   * the input-vault-key-modal to appear. Only shown once a vault salt
   * exists for this session but the local vault key doesn't (e.g. after a
   * re-login) — see `generateVaultKey()` for the no-salt-yet case.
   */
  async openEnterVaultKeyModal(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Enter Vault Key" }).click();
    await expect(this.page.getByTestId("input-vault-key-modal")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Fills the open input-vault-key-modal's "Vault Key Input" field. Must be
   * called with `openEnterVaultKeyModal()` already open.
   * @param key - The vault key value to attempt
   */
  async fillVaultKeyInput(key: string): Promise<void> {
    await this.page.getByLabel("Vault Key Input").fill(key);
  }

  /**
   * Clicks "Unlock" in the open input-vault-key-modal, submitting whatever
   * was filled via `fillVaultKeyInput()`.
   */
  async clickUnlockVaultKey(): Promise<void> {
    await this.page.getByRole("button", { name: "Unlock" }).click();
  }

  /**
   * Reports whether the input-vault-key-modal is currently open — `false`
   * means a just-submitted `clickUnlockVaultKey()` succeeded and the modal
   * closed itself.
   */
  private async isEnterVaultKeyModalOpen(): Promise<boolean> {
    return this.page.getByTestId("input-vault-key-modal").isVisible();
  }

  /**
   * Reads the open input-vault-key-modal's validation error text (e.g.
   * "Invalid vault key, please check and input again"). Empty if no error
   * is currently shown.
   */
  private async getVaultKeyModalError(): Promise<string> {
    return (
      (await this.page
        .getByTestId("input-vault-key-modal")
        .locator("p.notice.error")
        .textContent()) ?? ""
    ).trim();
  }

  /**
   * Waits for a just-clicked "Unlock" to resolve to its final outcome —
   * either the modal closing on its own (key accepted) or the error field
   * settling on a message (key rejected). Same wait-past-a-stale-read shape
   * as `waitForNewPluginOutcome()`.
   * @returns The validation error message, or `null` if the key was accepted
   */
  async waitForVaultKeyUnlockOutcome(): Promise<string | null> {
    let error: string | null = null;
    await expect(async () => {
      if (!(await this.isEnterVaultKeyModalOpen())) {
        error = null;
        return;
      }
      const current = await this.getVaultKeyModalError();
      expect(current).not.toBe("");
      error = current;
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return error;
  }

  /**
   * Closes the input-vault-key-modal via its own "X" close button, without
   * closing Preferences itself. A no-op if the modal already closed on its
   * own (e.g. after a successful `clickUnlockVaultKey()`). Confirmed live:
   * unlike most dialogs in this app, this one has no `isDismissable`
   * overlay behavior — Escape does nothing — and its close button carries
   * no accessible name, so it's targeted structurally as the modal's first
   * button (rendered in its title row, ahead of Unlock/Reset Vault Key/OK).
   */
  async closeEnterVaultKeyModal(): Promise<void> {
    const modal = this.page.getByTestId("input-vault-key-modal");
    if (!(await this.isEnterVaultKeyModalOpen())) return;
    await modal.getByRole("button").first().click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Resets the vault key from within the open input-vault-key-modal via its
   * "Reset Vault Key" confirm button (first click arms it, second/dblclick
   * confirms), waits for the modal to show the freshly-generated
   * replacement key, then dismisses the modal via its "OK" button. Must be
   * called with `openEnterVaultKeyModal()` already open.
   * @returns The newly-generated vault key
   */
  async resetVaultKeyFromModal(): Promise<string> {
    const modal = this.page.getByTestId("input-vault-key-modal");
    await modal.getByRole("button", { name: "Reset Vault Key" }).dblclick();
    const panel = modal.getByTestId("VaultKeyDisplayPanel");
    let value = "";
    await expect(async () => {
      value = (await panel.innerText()).trim();
      expect(value.length).toBeGreaterThan(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await modal.getByRole("button", { name: "OK" }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return value;
  }
}
