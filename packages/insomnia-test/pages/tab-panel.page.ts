import { type ElectronApplication, expect } from "@playwright/test";
import type { Page } from "playwright-core";

import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

/**
 * Shared plumbing for any component scoped to one tab-bar pane (a
 * request's own pane, or a Folder's "Open in New Tab" pane) — both render
 * the exact same tab-bar component (`["Auth", "Headers", "Scripts",
 * "Environment", "Docs"]`), just with a different outer container
 * selector. Subclasses/composed components take that container selector
 * (`pane`) through the constructor instead of declaring it as an abstract
 * field, so the same component class can be instantiated once per owning
 * page with that page's own `PANE`.
 */
export abstract class TabPanelPage extends BasePage {
  constructor(
    page: Page,
    protected readonly PANE: string,
    insomnia?: ElectronApplication,
  ) {
    super(page, insomnia);
  }

  /**
   * Waits for this pane to become visible, confirming it's open and active.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.PANE)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  protected get TABPANEL(): string {
    return `${this.PANE} [role="tabpanel"]`;
  }

  /**
   * Clicks the tab within this pane identified by its data-key.
   * @param tab - The data-key of the tab to switch to
   */
  protected async switchTab(tab: string): Promise<void> {
    await this.page
      .locator(`${this.PANE} [data-key="${tab}"][role="tab"]`)
      .click();
  }
}
