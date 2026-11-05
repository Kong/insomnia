import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { PreferencesTabComponent } from "./preferences-tab.component";

export interface LlmUrlBackendFormFields {
  url: string;
  model: string;
  apiKey: string;
  temperature: string;
  topP: string;
  maxTokens: string;
}

/**
 * The Preferences dialog's AI Settings tab: LLM backends and Smart Commits.
 */
export class PreferencesAiComponent extends PreferencesTabComponent {
  /**
   * Switches the open Preferences dialog to the "AI Settings" tab. Only
   * rendered once the bundled AI plugin is present and the user is logged
   * in — always true for this project's fixture.
   */
  async openAiSettingsTab(): Promise<void> {
    await this.dialog.getByRole("tab", { name: "AI Settings" }).click();
  }

  /**
   * Clicks a backend's nav button on the AI Settings tab (e.g. `"LLM URL"`,
   * or `"LLM URL Active"` once it's the active backend) to expand its
   * config panel. Must be called with `openAiSettingsTab()` already open.
   */
  async clickAiBackendNav(name: string): Promise<void> {
    await this.dialog.getByRole("button", { name }).click();
  }

  /**
   * Reports whether a backend's nav button currently carries the "Active"
   * badge (i.e. it's the app's current LLM backend). Must be called with
   * `openAiSettingsTab()` already open.
   */
  async isAiBackendActive(navLabel: string): Promise<boolean> {
    return this.dialog
      .getByRole("button", { name: `${navLabel} Active` })
      .isVisible();
  }

  /**
   * Fills the "url" backend panel's "LLM URL" field. Must be called with
   * the panel already expanded (see `clickAiBackendNav()`).
   */
  async setAiUrlBackendUrl(url: string): Promise<void> {
    await this.page.getByLabel("LLM URL").fill(url);
  }

  /**
   * Fills the "url" backend panel's "API Token" field. Must be called with
   * the panel already expanded (see `clickAiBackendNav()`).
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
   */
  async selectAiModel(modelId: string): Promise<void> {
    await this.page.getByLabel("Model").selectOption(modelId);
  }

  /**
   * Ensures the "Model" `<select>` is on screen, clicking whichever button
   * currently fetches it. An already-active backend that
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
   */
  private async getAiSettingsFieldValue(label: string): Promise<string> {
    return this.page.getByLabel(label).inputValue();
  }

  /**
   * Fills a labeled numeric input on the AI Settings tab's expanded
   * Advanced Options panel (e.g. `"Temperature (0-2):"`, `"Top P (0-1):"`,
   * `"Max Tokens (1-128000):"`). Must be called with
   * `openAiAdvancedOptions()` already open.
   */
  async setAiAdvancedOptionValue(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Clicks "Advanced Options" on the AI Settings tab's expanded backend
   * panel to reveal the Temperature/Top P/Max Tokens fields — a no-op if
   * they're already visible. The Preferences modal isn't
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
   * called with `openAiSettingsTab()` already open. On a
   * fresh mount (e.g. right after reopening Preferences), the panel's own
   * hydration from the app's async-loaded backend config can still be
   * mid-flight the instant this reads — for an already-configured backend
   * the "LLM URL" field is never genuinely blank, so this polls past a
   * transient empty read rather than racing it.
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
}
