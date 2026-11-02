import type { ScriptSandboxRuleGroup } from "@package/enums/script-sandbox-rule-group";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { step } from "@package/misc/step";
import type { GitCredential } from "@package/models/git-credential";
import type { AiUrlBackendSettings} from "@package/models/settings";
import { Settings } from "@package/models/settings";
import type { LlmUrlBackendFormFields } from "@package/pages/preferences-ai.page";
import { expect } from "@playwright/test";

import { BaseFlow } from "./base.flow";

export class PreferencesFlow extends BaseFlow {
  /**
   * Opens the Preferences dialog and applies the given settings, then
   * closes it. Only settings that are defined on `settings` are applied
   * (e.g. `validateSSL` is skipped when undefined).
   */
  @step()
  async set(settings: Settings): Promise<Settings> {
    const { preferencesPage, preferencesCredentialsPage, preferencesPluginsPage, preferencesAiPage } = this.pageManager;
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
    if (settings.hideSecretValuesInPreviewAndConsole !== undefined) {
      await preferencesPage.setHideSecretValuesInPreviewAndConsole(
        settings.hideSecretValuesInPreviewAndConsole,
      );
    }
    if (settings.dataFolders !== undefined) {
      for (const path of settings.dataFolders) {
        await preferencesPage.addDataFolder(path);
      }
    }
    if (settings.pluginSandboxEnabled !== undefined) {
      await preferencesPluginsPage.openScriptingTab();
      await preferencesPluginsPage.setTemplateTagSandbox(
        settings.pluginSandboxEnabled,
      );
    }
    if (settings.filterResponsesByEnv !== undefined) {
      await preferencesPage.setFilterResponsesByEnvironment(
        settings.filterResponsesByEnv,
      );
    }
    if (settings.cloudCredentials !== undefined) {
      await preferencesCredentialsPage.openCredentialsTab();
      for (const credential of settings.cloudCredentials) {
        if (credential.provider === "aws") {
          await preferencesCredentialsPage.createAwsCloudCredential(credential);
        } else if (credential.provider === "gcp") {
          await preferencesCredentialsPage.createGcpCloudCredential(credential);
        } else {
          await preferencesCredentialsPage.createHashiCorpCloudCredential(credential);
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
      await preferencesAiPage.openAiSettingsTab();
      if (settings.aiUrlBackend === null) {
        const fields =
          await preferencesAiPage.getUrlBackendFormValues("LLM URL Active");
        await preferencesAiPage.clickDeactivateAiBackend();
        let isActive = true;
        await expect(async () => {
          isActive = await preferencesAiPage.isAiBackendActive("LLM URL");
          expect(isActive).toBe(false);
        }).toPass({ timeout: DEFAULT_TIMEOUT });
        aiUrlBackendResult = this.toAiUrlBackendSettings(fields, isActive);
      } else {
        const { url, model, apiKey, temperature, topP, maxTokens } =
          settings.aiUrlBackend;
        await preferencesAiPage.clickAiBackendNav("LLM URL");
        await preferencesAiPage.setAiUrlBackendUrl(url);
        if (apiKey !== undefined) {
          await preferencesAiPage.setAiUrlBackendApiToken(apiKey);
        }
        await preferencesAiPage.clickLoadAiModels();
        await preferencesAiPage.selectAiModel(model);
        if (
          temperature !== undefined ||
          topP !== undefined ||
          maxTokens !== undefined
        ) {
          await preferencesAiPage.openAiAdvancedOptions();
          if (temperature !== undefined) {
            await preferencesAiPage.setAiAdvancedOptionValue(
              "Temperature (0-2):",
              String(temperature),
            );
          }
          if (topP !== undefined) {
            await preferencesAiPage.setAiAdvancedOptionValue(
              "Top P (0-1):",
              String(topP),
            );
          }
          if (maxTokens !== undefined) {
            await preferencesAiPage.setAiAdvancedOptionValue(
              "Max Tokens (1-128000):",
              String(maxTokens),
            );
          }
        }
        await preferencesAiPage.clickActivateAiBackend();
        const fields =
          await preferencesAiPage.getUrlBackendFormValues("LLM URL Active");
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
   */
  @step()
  async createPlugin(name: string): Promise<void> {
    const { preferencesPage, preferencesPluginsPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPluginsPage.openPluginsTab();
    await preferencesPluginsPage.openNewPlugin();
    await preferencesPluginsPage.setNewPluginName(name);
    await preferencesPluginsPage.clickGenerateNewPlugin();
    const error = await preferencesPluginsPage.waitForNewPluginOutcome();
    if (error !== null) {
      await preferencesPluginsPage.closeNewPluginModal();
      await preferencesPage.close();
      throw new Error(error);
    }
    await preferencesPage.close();
  }

  /**
   * Opens Preferences -> Scripting and toggles a single rule group's
   * sandbox switch, then closes Preferences.
   */
  @step()
  async toggleScriptSandboxRule(
    group: ScriptSandboxRuleGroup,
    enabled: boolean,
  ): Promise<void> {
    const { preferencesPage, preferencesPluginsPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPluginsPage.openScriptingTab();
    await preferencesPluginsPage.setScriptSandboxRule(group, enabled);
    await preferencesPage.close();
  }

  /**
   * Adds a custom (username/PAT) Git credential via Preferences ->
   * Credentials, so it's available to select when cloning/connecting a Git
   * Sync project.
   */
  @step()
  async addGitCredential(credential: GitCredential): Promise<void> {
    const { preferencesPage, preferencesCredentialsPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesCredentialsPage.openCredentialsTab();
    await preferencesCredentialsPage.addCustomCredential(credential);
    await preferencesPage.close();
  }

  /**
   * Opens Preferences -> Plugins and reads the user-installed
   * `insomnia-plugin-*` names currently listed there, then closes
   * Preferences. Does NOT include bundled plugins (see
   * `PreferencesPage.getBundlePlugins()`), which never appear on this tab.
   */
  @step()
  async getInstalledPlugins(): Promise<string[]> {
    const { preferencesPage, preferencesPluginsPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesPluginsPage.openPluginsTab();
    const names = await preferencesPluginsPage.getPluginNames();
    await preferencesPage.close();
    return names;
  }

  /**
   * Opens Preferences and generates a new vault key via the General tab's
   * Security section, then closes Preferences. Only succeeds when no vault
   * salt exists yet for this session (a fresh session, or one whose vault
   * state was just reset — see `resetVaultKey()`).
   */
  @step()
  async generateVaultKey(): Promise<string> {
    const { preferencesPage, preferencesVaultPage } = this.pageManager;
    await preferencesPage.open();
    const key = await preferencesVaultPage.generateVaultKey();
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
   */
  @step()
  async enterVaultKey(key: string): Promise<string | null> {
    const { preferencesPage, preferencesVaultPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesVaultPage.openEnterVaultKeyModal();
    await preferencesVaultPage.fillVaultKeyInput(key);
    await preferencesVaultPage.clickUnlockVaultKey();
    const error = await preferencesVaultPage.waitForVaultKeyUnlockOutcome();
    await preferencesVaultPage.closeEnterVaultKeyModal();
    await preferencesPage.close();
    return error;
  }

  /**
   * Opens Preferences, resets the vault key via the General tab's "Enter
   * Vault Key" modal's "Reset Vault Key" confirm button, then closes
   * Preferences. Requires a vault salt to already exist for this session
   * (e.g. via the `vaultSalt` fixture override).
   */
  @step()
  async resetVaultKey(): Promise<string> {
    const { preferencesPage, preferencesVaultPage } = this.pageManager;
    await preferencesPage.open();
    await preferencesVaultPage.openEnterVaultKeyModal();
    const key = await preferencesVaultPage.resetVaultKeyFromModal();
    await preferencesPage.close();
    return key;
  }
}
