import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { DigestEncoding, HashAlgorithm } from "@package/models/template-tag";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class TemplateTagPage extends BasePage {
  private readonly MODAL = '[role="dialog"]';
  private readonly modal = new ModalComponent(this.page);
  private readonly LIVE_PREVIEW = `${this.MODAL} textarea[aria-label="Live Preview"]`;

  /**
   * Waits for the tag-editor modal ("Edit Tag") to become visible.
   */
  async navigate(): Promise<void> {
    await this.modal.expectOpen();
  }

  /**
   * Clicks the nunjucks-tag span whose `data-template` matches
   * `template` exactly (e.g. one just typed into a CodeMirror field via
   * another Page's setter, which Insomnia's own syntax highlighting turns
   * into a clickable span), and waits for its "Edit Tag" modal to open.
   */
  async openTagByTemplate(template: string): Promise<void> {
    const escaped = template.replace(/["\\]/g, "\\$&");
    await this.page
      .locator(`[data-nunjucks-tag="true"][data-template="${escaped}"]`)
      .click();
    await this.navigate();
  }

  /**
   * Reads the "Function to Perform" select's current tag type.
   */
  async getFunctionName(): Promise<string> {
    return this.page
      .locator(this.MODAL)
      .getByLabel("Function to Perform")
      .inputValue();
  }

  /**
   * Reads the `hash` tag's "Algorithm" argument.
   */
  async getAlgorithm(): Promise<string> {
    return this.getArgumentField("algorithm").getByRole("combobox").inputValue();
  }

  /**
   * Switches the `hash` tag's "Algorithm" argument.
   */
  async setAlgorithm(algorithm: HashAlgorithm): Promise<void> {
    const select = this.getArgumentField("algorithm").getByRole("combobox");
    await select.selectOption(algorithm);
    // Reading .inputValue() immediately after
    // selectOption() can momentarily still report the old value in this
    // Electron app, even though the underlying property/app state has
    // already updated — poll until it settles so callers never race it.
    await expect(select).toHaveValue(algorithm, { timeout: DEFAULT_TIMEOUT });
    // Also wait for the Live Preview's own recompute to finish before
    // returning — see waitForPreviewSettled()'s doc comment for why this
    // matters even though only the select's own value is this method's
    // direct concern.
    await this.waitForPreviewSettled();
  }

  /**
   * Reads the `hash` tag's "Digest Encoding" argument.
   */
  async getDigestEncoding(): Promise<string> {
    return this.getArgumentField("digest-encoding").getByRole("combobox").inputValue();
  }

  /**
   * Switches the `hash` tag's "Digest Encoding" argument.
   */
  async setDigestEncoding(encoding: DigestEncoding): Promise<void> {
    const select = this.getArgumentField("digest-encoding").getByRole("combobox");
    await select.selectOption(encoding);
    await expect(select).toHaveValue(encoding, { timeout: DEFAULT_TIMEOUT });
    await this.waitForPreviewSettled();
  }

  /**
   * Reads the `hash` tag's "Input" argument — the raw value to hash.
   */
  async getInput(): Promise<string> {
    return this.getArgumentField("input").getByRole("textbox").inputValue();
  }

  /**
   * Sets the `hash` tag's "Input" argument — the raw value to hash.
   */
  async setInput(value: string): Promise<void> {
    const input = this.getArgumentField("input").getByRole("textbox");
    await input.fill(value);
    await expect(input).toHaveValue(value);
    await this.waitForPreviewSettled();
  }

  /**
   * Reads the modal's "Live Preview" — the tag's resolved value against
   * the current environment, re-rendered on every argument change. Waits
   * out the transient "rendering..." state first.
   */
  async getPreview(): Promise<string> {
    await this.waitForPreviewSettled();
    return this.page.locator(this.LIVE_PREVIEW).inputValue();
  }

  /**
   * Polls the Live Preview until it reports the same non-"rendering..."
   * value across two consecutive reads. A single non-"rendering..." read
   * isn't enough: the app's own preview recompute (kicked
   * off by an argument change) can itself lag behind the change by tens
   * of ms, so a poll that starts before the recompute has actually begun
   * observes last render's now-stale value and passes immediately. Worse,
   * `hash`'s three argument setters (algorithm/digest encoding/input) each
   * fire their own independent, unguarded recompute — if a caller moves on
   * to the next setter before the previous one's recompute has finished,
   * the two can race and whichever resolves last (not necessarily the
   * latest one) wins, silently reverting the preview to a stale value.
   * Calling this after every setter forces each recompute to finish before
   * the next argument change fires, so they never overlap.
   */
  private async waitForPreviewSettled(requireNonEmpty = false): Promise<void> {
    const preview = this.page.locator(this.LIVE_PREVIEW);
    let previous: string | null = null;
    await expect(async () => {
      const current = await preview.inputValue();
      if (requireNonEmpty) {
        expect(current).not.toBe("");
      }
      // eslint-disable-next-line playwright/prefer-web-first-assertions -- needs the raw string to compare against `previous` across polls, not just assert against a fixed expected value
      expect(current).not.toBe("rendering...");
      const stable = current === previous;
      previous = current;
      expect(stable).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Switches the `vault` tag's "Credential For Vault Service Provider"
   * select to a cloud credential already created via
   * `PreferencesFlow.addCloudCredentials()` — only credentials matching
   * this tag's own provider argument (e.g. `{% vault 'aws' %}` only lists
   * AWS credentials) appear as options. The Live Preview's
   * re-fetch off the new selection lags behind `selectOption()` itself
   * resolving, and by an inconsistent amount and through more than one
   * transient shape (an empty value, or a fixed "Credential ID or
   * Credential Key is required" error) rather than always the generic
   * "rendering..." state `getPreview()` already waits out — so this polls
   * until two consecutive reads agree on a non-empty, non-"rendering..."
   * value instead of racing any single transient shape.
   */
  async selectVaultCredential(name: string): Promise<void> {
    const select = this.page
      .locator(this.MODAL)
      .getByLabel("Credential For Vault Service Provider");
    await select.selectOption(name);
    await this.waitForPreviewSettled(true);
  }

  /**
   * Clicks "Done", committing the tag (with any argument changes) back
   * into the field it was opened from, and waits for the modal to close.
   */
  async done(): Promise<void> {
    await this.modal.confirm("Done");
  }

  /**
   * Clicks "Clear" in the open tag editor, wiping the value a `prompt`
   * tag cached under its storage key, then waits for the Live Preview to
   * settle.
   */
  async clearCachedValue(): Promise<void> {
    await this.modal.clickButton("Clear", false);
    await this.waitForPreviewSettled();
  }

  /**
   * Clicks the request pane's Send button without checking for a
   * resulting dialog (unlike `RequestPage.send()`, which treats any
   * dialog as an error), so a `prompt` tag's input dialog can be answered
   * afterwards.
   */
  async clickSend(): Promise<void> {
    await this.page
      .getByTestId("request-pane")
      .getByRole("button", { name: "Send" })
      .click();
  }

  /**
   * Waits for a `prompt` tag's input dialog (identified by its label
   * text), reads its input's `type`, fills in `value` and submits.
   */
  async answerPrompt(label: string, value: string): Promise<string> {
    const promptModal = new ModalComponent(
      this.page,
      this.page.getByRole("dialog").filter({ hasText: label }),
    );
    const dialog = promptModal.root;
    await dialog.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    const input = dialog.locator("#prompt-input");
    const inputType = (await input.getAttribute("type")) ?? "";
    await input.fill(value);
    await promptModal.clickButton("Submit", false);
    await dialog.waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
    return inputType;
  }

  private getArgumentField(arg: "algorithm" | "digest-encoding" | "input"): Locator {
    return this.page.locator(this.MODAL).getByTestId(`tag-arg-${arg}`);
  }
}
