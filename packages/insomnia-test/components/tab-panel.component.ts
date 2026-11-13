import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { findDocs } from "@package/misc/db";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { CodeEditorComponent } from "./code-editor.component";
import { TabsComponent } from "./tabs.component";

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
export class TabPanelComponent extends BaseComponent {
  constructor(
    page: Page,
    readonly PANE: string,
  ) {
    super(page, page.locator(PANE));
  }

  /**
   * Waits for this pane to become visible, confirming it's open and active.
   */
  async waitUntilVisible(): Promise<void> {
    await expect(this.root).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** The pane's tab bar. */
  get tabs(): TabsComponent {
    return new TabsComponent(this.page, this.root);
  }

  get TABPANEL(): string {
    return `${this.PANE} [role="tabpanel"]`;
  }

  /**
   * Clicks the tab within this pane identified by its data-key.
   */
  async switchTab(tab: string): Promise<void> {
    await this.tabs.tab(tab).click();
  }

  /**
   * Reads a CodeMirror editor's current value. See `CodeEditorComponent`.
   */
  protected async readCodeMirror(locator: Locator): Promise<string> {
    return CodeEditorComponent.fromCodeMirror(this.page, locator).getValue();
  }

  /**
   * Sets a CodeMirror editor's value and confirms it holds. See
   * `CodeEditorComponent.setValue`.
   */
  protected async setCodeMirrorValue(
    cmLocator: Locator,
    text: string,
  ): Promise<void> {
    await CodeEditorComponent.fromCodeMirror(this.page, cmLocator).setValue(
      text,
    );
  }

  /**
   * Reads every live document of the model stored in `dbFile` from the
   * app's database.
   */
  protected async readPersistedDocs(dbFile: string): Promise<any[]> {
    return findDocs(this.page, dbFile);
  }
}
