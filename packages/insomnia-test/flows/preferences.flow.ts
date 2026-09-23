import { expect } from "@playwright/test";
import { ScriptSandboxRuleGroup } from "../enums/script-sandbox-rule-group";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { GitCredential } from "../models/git-credential";
import { AiUrlBackendSettings, Settings } from "../models/settings";
import { LlmUrlBackendFormFields } from "../pages/preferences.page";
import { BaseFlow } from "./base.flow";

export class PreferencesFlow extends BaseFlow {
  /**
   * Opens the Preferences dialog and applies the given settings, then
   * closes it. Only settings that are defined on `settings` are applied
   * (e.g. `validateSSL` is skipped when undefined).
   * @param settings - The settings to apply; undefined fields are left unchanged. `cloudCredentials` creates every listed cloud (vault) service credential via Preferences -> Credentials, so it's available to select as a `vault` template tag's "Credential For Vault Service Provider"
   * @returns A `Settings` echoing back read-back state for settings whose UI it's already visiting anyway (currently just `aiUrlBackend`, with `isActive` set) — most callers can ignore this
   */
  async set(settings: Settings): Promise<Settings> {
    const preferencesPage = this.pageManager.preferencesPage;
    let aiUrlBackendResult: AiUrlBackendSettings | undefined;
    await preferencesPage.open();
    if (settings.validateSSL !== undefined) {
      await preferencesPage.setValidateSSL(settings.validateSSL);
    }
    if (settings.sidebarFocusForCollections !== undefined) {
      await preferencesPage.setSidebarFocusForCollections(
        settings.sidebarFocusForCollections,
      );
    }
    if (settings.showLegacyUnitTests !== undefined) {
      await preferencesPage.setShowLegacyUnitTests(
        settings.showLegacyUnitTests,
      );
    }
    if (settings.dataFolders !== undefined) {
      for (const path of settings.dataFolders) {
        await preferencesPage.addDataFolder(path);
      }
    }
    if (settings.templateTagSandboxEnabled !== undefined) {
      await preferencesPage.openScriptingTab();
      await preferencesPage.setTemplateTagSandbox(
        settings.templateTagSandboxEnabled,
      );
    }
    if (settings.filterResponsesByEnv !== undefined) {
      await preferencesPage.setFilterResponsesByEnvironment(
        settings.filterResponsesByEnv,
      );
    }
    if (settings.cloudCredentials !== undefined) {
      await preferencesPage.openCredentialsTab();
      for (const credential of settings.cloudCredentials) {
        if (credential.provider === "aws") {
          await preferencesPage.createAwsCloudCredential(credential);
        } else if (credential.provider === "gcp") {
          await preferencesPage.createGcpCloudCredential(credential);
        } else {
          await preferencesPage.createHashiCorpCloudCredential(credential);
        }
      }
    }
    if (settings.timeout !== undefined) {
      await preferencesPage.setRequestTimeout(settings.timeout);
    }
    if (
      settings.proxyEnabled !== undefined ||
      settings.httpProxy !== undefined ||
      settings.httpsProxy !== undefined ||
      settings.noProxy !== undefined
    ) {
      await preferencesPage.openProxyTab();
      if (settings.proxyEnabled !== undefined) {
        await preferencesPage.setProxyEnabled(settings.proxyEnabled);
      }
      if (settings.httpProxy !== undefined) {
        await preferencesPage.setHttpProxy(settings.httpProxy);
      }
      if (settings.httpsProxy !== undefined) {
        await preferencesPage.setHttpsProxy(settings.httpsProxy);
      }
      if (settings.noProxy !== undefined) {
        await preferencesPage.setNoProxy(settings.noProxy);
      }
    }
    if (settings.aiUrlBackend !== undefined) {
      await preferencesPage.openAiSettingsTab();
      if (settings.aiUrlBackend === null) {
        const fields =
          await preferencesPage.getUrlBackendFormValues("LLM URL Active");
        await preferencesPage.clickDeactivateAiBackend();
        let isActive = true;
        await expect(async () => {
          isActive = await preferencesPage.isAiBackendActive("LLM URL");
          expect(isActive).toBe(false);
        }).toPass({ timeout: DEFAULT_TIMEOUT });
        aiUrlBackendResult = this.toAiUrlBackendSettings(fields, isActive);
      } else {
        const { url, model, apiKey, temperature, topP, maxTokens } =
          settings.aiUrlBackend;
        await preferencesPage.clickAiBackendNav("LLM URL");
        await preferencesPage.setAiUrlBackendUrl(url);
        if (apiKey !== undefined) {
          await preferencesPage.setAiUrlBackendApiToken(apiKey);
        }
        await preferencesPage.clickLoadAiModels();
        await preferencesPage.selectAiModel(model);
        if (
          temperature !== undefined ||
          topP !== undefined ||
          maxTokens !== undefined
        ) {
          await preferencesPage.openAiAdvancedOptions();
          if (temperature !== undefined) {
            await preferencesPage.setAiAdvancedOptionValue(
              "Temperature (0-2):",
              String(temperature),
            );
          }
          if (topP !== undefined) {
            await preferencesPage.setAiAdvancedOptionValue(
              "Top P (0-1):",
              String(topP),
            );
          }
          if (maxTokens !== undefined) {
            await preferencesPage.setAiAdvancedOptionValue(
              "Max Tokens (1-128000):",
              String(maxTokens),
            );
          }
        }
        await preferencesPage.clickActivateAiBackend();
        const fields =
          await preferencesPage.getUrlBackendFormValues("LLM URL Active");
        aiUrlBackendResult = this.toAiUrlBackendSettings(fields, true);
      }
    }
    await preferencesPage.close();
    return new Settings({ aiUrlBackend: aiUrlBackendResult });
  }

  private toAiUrlBackendSettings(
    fields: LlmUrlBackendFormFields,
    isActive: boolean,
  ): AiUrlBackendSettings {
    return {
      url: fields.url,
      model: fields.model,
      apiKey: fields.apiKey,
      temperature: Number(fields.temperature),
      topP: Number(fields.topP),
      maxTokens: Number(fields.maxTokens),
      isActive,
    };
  }

  /**
   * Opens Preferences -> Plugins -> "New Plugin" and attempts to generate
   * a plugin named `insomnia-plugin-<name>`. If the name is rejected,
   * throws an `Error` whose message is the validation error shown in the
   * modal (leaving neither the modal nor Preferences open) — assert with
   * `.rejects.toThrow(...)`. If accepted, the modal closes on its own and
   * this closes Preferences to finish.
   * @param name - The plugin name's suffix to attempt, e.g. `"my-plugin"`
   */
  async createPlugin(name: string): Promise<void> {
    const preferencesPage = this.pageManager.preferencesPage;
    await preferencesPage.open();
    await preferencesPage.openPluginsTab();
    await preferencesPage.openNewPlugin();
    await preferencesPage.setNewPluginName(name);
    await preferencesPage.clickGenerateNewPlugin();
    const error = await preferencesPage.waitForNewPluginOutcome();
    if (error !== null) {
      await preferencesPage.closeNewPluginModal();
      await preferencesPage.close();
      throw new Error(error);
    }
    await preferencesPage.close();
  }

  /**
   * Opens Preferences -> Scripting and toggles a single rule group's
   * sandbox switch, then closes Preferences.
   * @param group - The rule group to toggle
   * @param enabled - Whether the rule group should be enabled
   */
  async toggleScriptSandboxRule(
    group: ScriptSandboxRuleGroup,
    enabled: boolean,
  ): Promise<void> {
    const preferencesPage = this.pageManager.preferencesPage;
    await preferencesPage.open();
    await preferencesPage.openScriptingTab();
    await preferencesPage.setScriptSandboxRule(group, enabled);
    await preferencesPage.close();
  }

  /**
   * Adds a custom (username/PAT) Git credential via Preferences ->
   * Credentials, so it's available to select when cloning/connecting a Git
   * Sync project.
   * @param credential - The custom credential to add
   */
  async addGitCredential(credential: GitCredential): Promise<void> {
    const { preferencesPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPage.openCredentialsTab();
    await preferencesPage.addCustomCredential(credential);
    await preferencesPage.close();
  }

  /**
   * Opens Preferences -> Plugins and reads the user-installed
   * `insomnia-plugin-*` names currently listed there, then closes
   * Preferences. Does NOT include bundled plugins (see
   * `PreferencesPage.getBundlePlugins()`), which never appear on this tab.
   * @returns The registered user-installed plugin names, in list order
   */
  async getInstalledPlugins(): Promise<string[]> {
    const { preferencesPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPage.openPluginsTab();
    const names = await preferencesPage.getPluginNames();
    await preferencesPage.close();
    return names;
  }

  /**
   * Opens Preferences and generates a new vault key via the General tab's
   * Security section, then closes Preferences. Only succeeds when no vault
   * salt exists yet for this session (a fresh session, or one whose vault
   * state was just reset — see `resetVaultKey()`).
   * @returns The generated vault key
   */
  async generateVaultKey(): Promise<string> {
    const { preferencesPage } = this.pageManager;
    await preferencesPage.open();
    const key = await preferencesPage.generateVaultKey();
    await preferencesPage.close();
    return key;
  }

  /**
   * Opens Preferences, attempts to unlock the vault with `key` via the
   * General tab's "Enter Vault Key" modal, and closes Preferences. Requires
   * a vault salt to already exist for this session (e.g. via the `vaultSalt`
   * fixture override). If `key` is rejected, returns the modal's own error
   * message instead of throwing (the modal stays open on a rejection, so
   * there's no dialog to surface via `.rejects.toThrow()`); returns `null`
   * on success.
   * @param key - The vault key to attempt
   */
  async enterVaultKey(key: string): Promise<string | null> {
    const { preferencesPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPage.openEnterVaultKeyModal();
    await preferencesPage.fillVaultKeyInput(key);
    await preferencesPage.clickUnlockVaultKey();
    const error = await preferencesPage.waitForVaultKeyUnlockOutcome();
    await preferencesPage.closeEnterVaultKeyModal();
    await preferencesPage.close();
    return error;
  }

  /**
   * Opens Preferences, resets the vault key via the General tab's "Enter
   * Vault Key" modal's "Reset Vault Key" confirm button, then closes
   * Preferences. Requires a vault salt to already exist for this session
   * (e.g. via the `vaultSalt` fixture override).
   * @returns The newly-generated replacement vault key
   */
  async resetVaultKey(): Promise<string> {
    const { preferencesPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPage.openEnterVaultKeyModal();
    const key = await preferencesPage.resetVaultKeyFromModal();
    await preferencesPage.close();
    return key;
  }
}
