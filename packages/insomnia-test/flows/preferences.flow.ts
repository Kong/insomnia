import type { LlmUrlBackendFormFields } from "@package/components/preferences-ai.component";
import type { ScriptSandboxRuleGroup } from "@package/enums/script-sandbox-rule-group";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { step } from "@package/misc/step";
import type { GitCredential } from "@package/models/git-credential";
import type { AiUrlBackendSettings} from "@package/models/settings";
import { Settings } from "@package/models/settings";
import { expect } from "@playwright/test";

import { BaseFlow } from "./base.flow";

type Answer = "continue" | "cancel";

export class PreferencesFlow extends BaseFlow {
  /**
   * Opens the Preferences dialog and applies the given settings, then
   * closes it. Only settings that are defined on `settings` are applied
   * (e.g. `validateSSL` is skipped when undefined).
   */
  @step()
  async set(settings: Settings): Promise<Settings> {
    const { preferences, preferencesCredentials, preferencesPlugins, preferencesAi } = this.pageManager;
    let aiUrlBackendResult: AiUrlBackendSettings | undefined;
    await preferences.open();
    if (settings.validateSSL !== undefined) {
      await preferences.setValidateSSL(settings.validateSSL);
    }
    if (settings.sidebarFocusForCollections !== undefined) {
      await preferences.setSidebarFocusForCollections(
        settings.sidebarFocusForCollections,
      );
    }
    if (settings.showLegacyUnitTests !== undefined) {
      await preferences.setShowLegacyUnitTests(
        settings.showLegacyUnitTests,
      );
    }
    if (settings.hideSecretValuesInPreviewAndConsole !== undefined) {
      await preferences.setHideSecretValuesInPreviewAndConsole(
        settings.hideSecretValuesInPreviewAndConsole,
      );
    }
    if (settings.dataFolders !== undefined) {
      for (const path of settings.dataFolders) {
        await preferences.addDataFolder(path);
      }
    }
    if (settings.pluginSandboxEnabled !== undefined) {
      await preferencesPlugins.openScriptingTab();
      await preferencesPlugins.setTemplateTagSandbox(
        settings.pluginSandboxEnabled,
      );
    }
    if (settings.filterResponsesByEnv !== undefined) {
      await preferences.setFilterResponsesByEnvironment(
        settings.filterResponsesByEnv,
      );
    }
    if (settings.cloudCredentials !== undefined) {
      await preferencesCredentials.openCredentialsTab();
      for (const credential of settings.cloudCredentials) {
        if (credential.provider === "aws") {
          await preferencesCredentials.createAwsCloudCredential(credential);
        } else if (credential.provider === "gcp") {
          await preferencesCredentials.createGcpCloudCredential(credential);
        } else {
          await preferencesCredentials.createHashiCorpCloudCredential(credential);
        }
      }
    }
    if (settings.timeout !== undefined) {
      await preferences.setRequestTimeout(settings.timeout);
    }
    if (
      settings.proxyEnabled !== undefined ||
      settings.httpProxy !== undefined ||
      settings.httpsProxy !== undefined ||
      settings.noProxy !== undefined
    ) {
      await preferences.openProxyTab();
      if (settings.proxyEnabled !== undefined) {
        await preferences.setProxyEnabled(settings.proxyEnabled);
      }
      if (settings.httpProxy !== undefined) {
        await preferences.setHttpProxy(settings.httpProxy);
      }
      if (settings.httpsProxy !== undefined) {
        await preferences.setHttpsProxy(settings.httpsProxy);
      }
      if (settings.noProxy !== undefined) {
        await preferences.setNoProxy(settings.noProxy);
      }
    }
    if (settings.aiUrlBackend !== undefined) {
      await preferencesAi.openAiSettingsTab();
      if (settings.aiUrlBackend === null) {
        const fields =
          await preferencesAi.getUrlBackendFormValues("LLM URL Active");
        await preferencesAi.clickDeactivateAiBackend();
        let isActive = true;
        await expect(async () => {
          isActive = await preferencesAi.isAiBackendActive("LLM URL");
          expect(isActive).toBe(false);
        }).toPass({ timeout: DEFAULT_TIMEOUT });
        aiUrlBackendResult = this.toAiUrlBackendSettings(fields, isActive);
      } else {
        const { url, model, apiKey, temperature, topP, maxTokens } =
          settings.aiUrlBackend;
        await preferencesAi.clickAiBackendNav("LLM URL");
        await preferencesAi.setAiUrlBackendUrl(url);
        if (apiKey !== undefined) {
          await preferencesAi.setAiUrlBackendApiToken(apiKey);
        }
        await preferencesAi.clickLoadAiModels();
        await preferencesAi.selectAiModel(model);
        if (
          temperature !== undefined ||
          topP !== undefined ||
          maxTokens !== undefined
        ) {
          await preferencesAi.openAiAdvancedOptions();
          if (temperature !== undefined) {
            await preferencesAi.setAiAdvancedOptionValue(
              "Temperature (0-2):",
              String(temperature),
            );
          }
          if (topP !== undefined) {
            await preferencesAi.setAiAdvancedOptionValue(
              "Top P (0-1):",
              String(topP),
            );
          }
          if (maxTokens !== undefined) {
            await preferencesAi.setAiAdvancedOptionValue(
              "Max Tokens (1-128000):",
              String(maxTokens),
            );
          }
        }
        await preferencesAi.clickActivateAiBackend();
        const fields =
          await preferencesAi.getUrlBackendFormValues("LLM URL Active");
        aiUrlBackendResult = this.toAiUrlBackendSettings(fields, true);
      }
    }
    await preferences.close();
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
    const { preferences, preferencesPlugins } = this.pageManager;
    await preferences.open();
    await preferencesPlugins.openPluginsTab();
    await preferencesPlugins.openNewPlugin();
    await preferencesPlugins.setNewPluginName(name);
    await preferencesPlugins.clickGenerateNewPlugin();
    const error = await preferencesPlugins.waitForNewPluginOutcome();
    if (error !== null) {
      await preferencesPlugins.closeNewPluginModal();
      await preferences.close();
      throw new Error(error);
    }
    await preferences.close();
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
    const { preferences, preferencesPlugins } = this.pageManager;
    await preferences.open();
    await preferencesPlugins.openScriptingTab();
    await preferencesPlugins.setScriptSandboxRule(group, enabled);
    await preferences.close();
  }

  /**
   * Adds a custom (username/PAT) Git credential via Preferences ->
   * Credentials, so it's available to select when cloning/connecting a Git
   * Sync project.
   */
  @step()
  async addGitCredential(credential: GitCredential): Promise<void> {
    const { preferences, preferencesCredentials } = this.pageManager;
    await preferences.open();
    await preferencesCredentials.openCredentialsTab();
    await preferencesCredentials.addCustomCredential(credential);
    await preferences.close();
  }

  /**
   * Opens Preferences -> Plugins and reads the user-installed
   * `insomnia-plugin-*` names currently listed there, then closes
   * Preferences. Does NOT include bundled plugins (see
   * `PreferencesComponent.getBundlePlugins()`), which never appear on this tab.
   */
  @step()
  async getInstalledPlugins(): Promise<string[]> {
    const { preferences, preferencesPlugins } = this.pageManager;
    await preferences.open();
    await preferencesPlugins.openPluginsTab();
    const names = await preferencesPlugins.getPluginNames();
    await preferences.close();
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
    const { preferences, preferencesVault } = this.pageManager;
    await preferences.open();
    const key = await preferencesVault.generateVaultKey();
    await preferences.close();
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
    const { preferences, preferencesVault } = this.pageManager;
    await preferences.open();
    await preferencesVault.openEnterVaultKeyModal();
    await preferencesVault.fillVaultKeyInput(key);
    await preferencesVault.clickUnlockVaultKey();
    const error = await preferencesVault.waitForVaultKeyUnlockOutcome();
    await preferencesVault.closeEnterVaultKeyModal();
    await preferences.close();
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
    const { preferences, preferencesVault } = this.pageManager;
    await preferences.open();
    await preferencesVault.openEnterVaultKeyModal();
    const key = await preferencesVault.resetVaultKeyFromModal();
    await preferences.close();
    return key;
  }

  /** Opens Preferences and waits until the Local Encryption Key section has settled. */
  @step()
  async openKeyPanel(): Promise<void> {
    const { preferences, localEncryptionKey } = this.pageManager;
    await preferences.open();
    await localEncryptionKey.waitUntilSettled();
  }

  /**
   * Copy Key: clicks it, reads the confirmation's text, answers it, and
   * returns what was on the confirmation and, for "continue", what the
   * button then shows.
   */
  @step()
  async copyKey(answer: Answer = "continue"): Promise<{ warning: string; buttonText: string }> {
    const { localEncryptionKey } = this.pageManager;
    await localEncryptionKey.copyButton.click();
    const warning = await this.readConfirmationAndAnswer(answer);
    if (answer === "continue") {
      await expect(localEncryptionKey.copyButton).toContainText("Copied", { timeout: DEFAULT_TIMEOUT });
    }
    return { warning, buttonText: (await localEncryptionKey.copyButton.innerText()).trim() };
  }

  /** The text currently on the system clipboard of the app. */
  @step()
  async readClipboard(): Promise<string> {
    return this.context.electronApp!.evaluate(({ clipboard }) => clipboard.readText());
  }

  @step()
  async writeClipboard(text: string): Promise<void> {
    await this.context.electronApp!.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
  }

  /**
   * Export Key: clicks it and answers the confirmation. The native save
   * dialog that follows is stubbed to resolve `filePath` — or, when
   * `filePath` is undefined, to a cancelled dialog. Resolves with the
   * confirmation's text and the file name the save dialog suggested.
   */
  @step()
  async exportKey(
    answer: Answer = "continue",
    filePath?: string,
  ): Promise<{ warning: string; suggestedPath: string | undefined }> {
    const { localEncryptionKey } = this.pageManager;
    const app = this.context.electronApp!;
    await app.evaluate(({ dialog }, target) => {
      (globalThis as any).__saveDialogOptions = undefined;
      dialog.showSaveDialog = (async (...args: any[]) => {
        (globalThis as any).__saveDialogOptions = args.at(-1);
        return target
          ? { canceled: false, filePath: target }
          : { canceled: true, filePath: undefined };
      }) as unknown as typeof dialog.showSaveDialog;
    }, filePath);
    await localEncryptionKey.exportButton.click();
    const warning = await this.readConfirmationAndAnswer(answer);
    if (answer === "cancel") return { warning, suggestedPath: undefined };
    await expect
      .poll(() => app.evaluate(() => (globalThis as any).__saveDialogOptions), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBeTruthy();
    const options = await app.evaluate(() => (globalThis as any).__saveDialogOptions);
    return { warning, suggestedPath: options?.defaultPath };
  }

  @step()
  async closeKeyPanel(): Promise<void> {
    await this.pageManager.preferences.close();
  }

  /** Whether Copy Key and Export Key are enabled in the open panel. */
  @step()
  async areKeyButtonsEnabled(): Promise<boolean> {
    return this.pageManager.localEncryptionKey.areButtonsEnabled();
  }

  /** Whether an error dialog (e.g. "Could not export the local encryption key") is open. */
  @step()
  async hasErrorDialog(): Promise<boolean> {
    return this.pageManager.localEncryptionKey.errorDialog.root.isVisible();
  }

  /** The notice shown instead of a usable key, or undefined when the key is available. */
  @step()
  async getKeyUnavailableNotice(): Promise<string | undefined> {
    const notice = this.pageManager.localEncryptionKey.unavailableNotice;
    return (await notice.isVisible()) ? (await notice.innerText()).trim() : undefined;
  }

  private async readConfirmationAndAnswer(answer: Answer): Promise<string> {
    const { confirmation } = this.pageManager.localEncryptionKey;
    await confirmation.waitForVisible();
    const warning = (await confirmation.root.innerText()).trim();
    await confirmation.clickButton(answer === "continue" ? "I understand, continue" : "Cancel", false);
    await confirmation.waitForHidden();
    return warning;
  }
}
