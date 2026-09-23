import { expect, Locator } from "@playwright/test";
import { BasePage } from "./base.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { DigestEncoding, HashAlgorithm } from "../models/template-tag";

export class TemplateTagPage extends BasePage {
  private readonly MODAL = '[role="dialog"]';
  private readonly LIVE_PREVIEW = `${this.MODAL} textarea[aria-label="Live Preview"]`;

  /**
   * Waits for the tag-editor modal ("Edit Tag") to become visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.MODAL)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks the `.nunjucks-tag` span whose `data-template` matches
   * `template` exactly (e.g. one just typed into a CodeMirror field via
   * another Page's setter, which Insomnia's own syntax highlighting turns
   * into a clickable span), and waits for its "Edit Tag" modal to open.
   * @param template - The exact raw tag text (e.g. "{% uuid 'v4' %}")
   */
  async openTagByTemplate(template: string): Promise<void> {
    const escaped = template.replace(/["\\]/g, "\\$&");
    await this.page.locator(`.nunjucks-tag[data-template="${escaped}"]`).click();
    await this.navigate();
  }

  /**
   * Reads the "Function to Perform" select's current tag type.
   * @returns The selected tag's name (e.g. "uuid", "base64")
   */
  async getFunctionName(): Promise<string> {
    return this.page
      .locator(this.MODAL)
      .getByLabel("Function to Perform")
      .inputValue();
  }

  /**
   * Reads the `hash` tag's "Algorithm" argument (index 0).
   * @returns The currently selected algorithm
   */
  async getAlgorithm(): Promise<string> {
    return this.getArgumentField(0).locator("select").inputValue();
  }

  /**
   * Switches the `hash` tag's "Algorithm" argument (index 0).
   * @param algorithm - The algorithm to select
   */
  async setAlgorithm(algorithm: HashAlgorithm): Promise<void> {
    const select = this.getArgumentField(0).locator("select");
    await select.selectOption(algorithm);
    // Confirmed live: reading .inputValue() immediately after
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
   * Reads the `hash` tag's "Digest Encoding" argument (index 1).
   * @returns The currently selected digest encoding
   */
  async getDigestEncoding(): Promise<string> {
    return this.getArgumentField(1).locator("select").inputValue();
  }

  /**
   * Switches the `hash` tag's "Digest Encoding" argument (index 1).
   * @param encoding - The digest encoding to select
   */
  async setDigestEncoding(encoding: DigestEncoding): Promise<void> {
    const select = this.getArgumentField(1).locator("select");
    await select.selectOption(encoding);
    await expect(select).toHaveValue(encoding, { timeout: DEFAULT_TIMEOUT });
    await this.waitForPreviewSettled();
  }

  /**
   * Reads the `hash` tag's "Input" argument (index 2) — the raw value to hash.
   * @returns The current input text
   */
  async getInput(): Promise<string> {
    return this.getArgumentField(2).locator("input").inputValue();
  }

  /**
   * Sets the `hash` tag's "Input" argument (index 2) — the raw value to hash.
   * @param value - The text to hash
   */
  async setInput(value: string): Promise<void> {
    const input = this.getArgumentField(2).locator("input");
    await input.fill(value);
    await expect(input).toHaveValue(value);
    await this.waitForPreviewSettled();
  }

  /**
   * Reads the modal's "Live Preview" — the tag's resolved value against
   * the current environment, re-rendered on every argument change. Waits
   * out the transient "rendering..." state first.
   * @returns The resolved preview text (or its error text, on a render error)
   */
  async getPreview(): Promise<string> {
    await this.waitForPreviewSettled();
    return this.page.locator(this.LIVE_PREVIEW).inputValue();
  }

  /**
   * Polls the Live Preview until it reports the same non-"rendering..."
   * value across two consecutive reads. A single non-"rendering..." read
   * isn't enough: confirmed live the app's own preview recompute (kicked
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
   * @param requireNonEmpty - Also rejects a transient empty value (only
   * `vault`'s async credential re-fetch needs this)
   */
  private async waitForPreviewSettled(requireNonEmpty = false): Promise<void> {
    const preview = this.page.locator(this.LIVE_PREVIEW);
    let previous: string | null = null;
    await expect(async () => {
      const current = await preview.inputValue();
      if (requireNonEmpty) {
        expect(current).not.toBe("");
      }
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
   * AWS credentials) appear as options. Confirmed live: the Live Preview's
   * re-fetch off the new selection lags behind `selectOption()` itself
   * resolving, and by an inconsistent amount and through more than one
   * transient shape (an empty value, or a fixed "Credential ID or
   * Credential Key is required" error) rather than always the generic
   * "rendering..." state `getPreview()` already waits out — so this polls
   * until two consecutive reads agree on a non-empty, non-"rendering..."
   * value instead of racing any single transient shape.
   * @param name - The cloud credential's display name
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
    await this.page
      .locator(this.MODAL)
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(this.page.locator(this.MODAL)).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  private getArgumentField(index: number): Locator {
    return this.page.locator(`${this.MODAL} label[data-arg-index="${index}"]`);
  }
}
