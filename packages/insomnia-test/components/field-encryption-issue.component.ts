import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The in-app dialog shown at startup when the encrypted fields of the local
 * database cannot be used: dialog A ("The local encryption key is not
 * available") or dialog B ("Some encrypted data could not be decrypted").
 * Neither can be dismissed with Esc or a click outside.
 */
export class FieldEncryptionIssueComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByTestId("field-encryption-issue-modal"));
  }

  private get heading(): Locator {
    return this.root.getByRole("heading");
  }

  /** Waits for the dialog and returns which one it is. */
  async kind(): Promise<"degraded" | "decryptionFailed"> {
    await expect(this.root).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const title = (await this.heading.innerText()).trim();
    if (title === "The local encryption key is not available") return "degraded";
    if (title === "Some encrypted data could not be decrypted") return "decryptionFailed";
    throw new Error(`Unexpected field-encryption dialog: "${title}"`);
  }

  /** Dialog B's list, one entry per affected document: `{ label, paths }`. */
  async affectedFields(): Promise<{ label: string; paths: string[] }[]> {
    return this.root
      .getByTestId("field-encryption-failures")
      .locator("li")
      .evaluateAll((items) =>
        items.map((li) => ({
          label: li.querySelector("span.font-semibold")?.getAttribute("title") ?? "",
          paths: Array.from(li.querySelectorAll("code")).map((c) => c.textContent ?? ""),
        })),
      );
  }

  /** "Continue" (dialog A) or "Continue without decryption" (dialog B). */
  async clickContinue(): Promise<void> {
    await this.root.getByTestId("field-encryption-continue").click();
  }

  /** Dialog B's "Reset affected fields". */
  async clickResetFields(): Promise<void> {
    await this.root.getByTestId("field-encryption-reset-fields").click();
  }

  /** Dialog A's "Reset local encryption key"; it asks a native confirmation next. */
  async clickResetKey(): Promise<void> {
    await this.root.getByTestId("field-encryption-reset-key").click();
  }

  /** Whether dialog A offers "Reset local encryption key". */
  async hasResetKeyButton(): Promise<boolean> {
    return (await this.root.getByTestId("field-encryption-reset-key").count()) > 0;
  }

  /** Whether the dialog ignores Esc and a click outside: it must still be open afterwards. */
  async survivesEscapeAndOutsideClick(): Promise<boolean> {
    await this.page.keyboard.press("Escape");
    await this.page.mouse.click(5, 5);
    return this.root.isVisible();
  }
}
