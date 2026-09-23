import { expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";

export class CommandPalettePage extends BasePage {
  private readonly DIALOG = '[aria-label="Command palette dialog"]';
  // The results listbox is a Popover portaled outside the dialog's own DOM
  // subtree (confirmed live), so it can't be scoped under DIALOG.
  private readonly OPTION = '[role="listbox"] [role="option"]';
  private readonly TRIGGER_BUTTON = '[data-testid="quick-search"]';

  /**
   * Closes the dialog: the first Escape only clears the search input, so
   * a second Escape is needed to actually dismiss it.
   */
  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.page.keyboard.press("Escape");
    await expect(this.page.locator(this.DIALOG)).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads back the names of every currently listed result, across all
   * sections (Requests/API Collections/Environments/etc — the "Collections
   * and documents" section was renamed "API Collections" by INS-3528).
   * @returns The visible result names, in on-screen order
   */
  async getResultNames(): Promise<string[]> {
    return this.page.locator(this.OPTION).allInnerTexts();
  }

  /**
   * Waits for the command palette dialog to become visible, confirming
   * it has been opened.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.DIALOG)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Opens the command palette by clicking its "Search.." trigger button.
   */
  async open(): Promise<void> {
    await this.page.locator(this.TRIGGER_BUTTON).click();
    await this.navigate();
  }

  /**
   * Opens the command palette via its keyboard shortcut (Cmd+P on
   * macOS).
   */
  async openViaShortcut(): Promise<void> {
    await this.page.keyboard.press("Meta+p");
    await this.navigate();
  }

  /**
   * Types into the search input and waits out the search's own 250ms
   * debounce plus its round trip, so the listed results reflect the
   * given query.
   * @param query - The search text to type
   */
  async search(query: string): Promise<void> {
    await this.page.locator(`${this.DIALOG} input`).fill(query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Clicks the first result whose visible text contains the given name,
   * navigating to it.
   * @param name - The result's name (or a substring of it) to select
   */
  async selectResult(name: string): Promise<void> {
    await this.page
      .locator(this.OPTION, { hasText: name })
      .first()
      .click();
    await this.page.waitForTimeout(500);
  }
}
