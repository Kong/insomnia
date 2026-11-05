import type { LlmUrlBackendFormFields } from "@package/components/preferences-ai.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { step } from "@package/misc/step";
import type { AiUrlBackendSettings} from "@package/models/settings";
import { Settings } from "@package/models/settings";
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
}
