import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { findDocs } from "@package/misc/db";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { CodeEditorComponent } from "./code-editor.component";
import { TabPanelComponent } from "./tab-panel.component";

/**
 * The Docs tab of a collection's pane: a markdown editor with Write/Preview
 * sub-tabs (it opens on Preview once there is content). `description` is
 * what the owning `dbFile` document stores.
 */
export class DocsTabComponent extends TabPanelComponent {
  constructor(
    page: Page,
    PANE: string,
    private readonly dbFile: string,
  ) {
    super(page, PANE);
  }

  private get panel(): Locator {
    return this.page
      .locator(this.TABPANEL)
      .filter({ has: this.page.locator('[aria-label="Markdown editor tabs"]') });
  }

  private async openWriteTab(): Promise<Locator> {
    await this.switchTab("docs");
    const writeTab = this.panel.locator('[role="tab"][data-key="write"]');
    await expect(writeTab).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    if ((await writeTab.getAttribute("aria-selected")) !== "true") await writeTab.click();
    const editor = this.panel.locator(".CodeMirror").first();
    await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return editor;
  }

  /** Reads the markdown source from the Write sub-tab. */
  async getDocs(): Promise<string> {
    const editor = await this.openWriteTab();
    return CodeEditorComponent.fromCodeMirror(this.page, editor).getValue();
  }

  /** Reads the rendered text from the Preview sub-tab. */
  async getPreviewText(): Promise<string> {
    await this.switchTab("docs");
    await this.panel.locator('[role="tab"][data-key="preview"]').click();
    return this.panel.locator('[role="tabpanel"][data-inert!="true"]').last().innerText();
  }

  /** Writes `text` into the Write sub-tab and waits for it to be saved. */
  async setDocs(text: string): Promise<void> {
    const editor = await this.openWriteTab();
    await CodeEditorComponent.fromCodeMirror(this.page, editor).setValue(text);
    await expect
      .poll(async () => (await findDocs(this.page, this.dbFile)).some((doc) => doc.description === text), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
  }
}
