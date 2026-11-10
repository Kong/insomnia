import { expect } from "@playwright/test";

import { TabPanelComponent } from "./tab-panel.component";

export interface RequestScripts {
  preRequest?: string;
  afterResponse?: string;
}

/**
 * The Scripts tab component, shared by any page that renders it — a
 * request's own pane (`RequestPage`, composing an instance as
 * `this.scripts`) and a Folder's own settings tab (`FolderPage`, same,
 * since folder-level scripts run for every descendant request before/
 * after that request's own script). Constructed with the owning page's
 * `pane` selector (its tab-bar's outer container), since that's the only
 * thing that differs between them.
 */
export class ScriptTabComponent extends TabPanelComponent {
  protected readonly AFTER_RESPONSE_EDITOR = "[role='tab'][data-key='after-response']";
  protected readonly PRE_REQUEST_EDITOR = "[role='tab'][data-key='pre-request']";

  /**
   * Reads back both the pre-request and after-response scripts by
   * switching to each script's editor pane in turn. Returns undefined
   * if both scripts are empty.
   */
  async getScripts(): Promise<RequestScripts | undefined> {
    await this.page
      .locator(`${this.PANE} [data-key="scripts"][role="tab"]`)
      .click();
    const panel = this.page.locator(this.TABPANEL);
    const editors = panel.locator(".CodeMirror");

    const preEditor = panel.locator(this.PRE_REQUEST_EDITOR);
    await preEditor.isVisible();
    await preEditor.click();
    const preRequest = await this.readCodeMirror(editors.first());

    const afterEditor = panel.locator(this.AFTER_RESPONSE_EDITOR);
    await afterEditor.isVisible();
    await afterEditor.click();
    const afterResponse = await this.readCodeMirror(editors.first());
    if (!preRequest && !afterResponse) return undefined;
    return {
      ...(preRequest ? { preRequest } : {}),
      ...(afterResponse ? { afterResponse } : {}),
    };
  }

  /**
   * Sets the pre-request and/or after-response scripts, switching to
   * each script's editor pane before writing into it. Only scripts that
   * are provided are written.
   */
  async setScripts(scripts: RequestScripts): Promise<void> {
    if (scripts.preRequest) {
      await this.writeScript(this.PRE_REQUEST_EDITOR, scripts.preRequest);
    }
    if (scripts.afterResponse) {
      await this.writeScript(this.AFTER_RESPONSE_EDITOR, scripts.afterResponse);
    }
  }

  /**
   * Switches to the Scripts tab and the given editor pane, then writes
   * `value` into it. The whole sequence is retried because the owning
   * page (notably a Folder tab in a Git Sync project) can re-mount after
   * the switch, resetting to its default tab and leaving the write on a
   * detached editor.
   */
  private async writeScript(paneSelector: string, value: string): Promise<void> {
    await expect(async () => {
      await this.switchTab("scripts");
      const panel = this.page.locator(this.TABPANEL);
      const pane = panel.locator(paneSelector);
      if ((await pane.getAttribute("aria-selected", { timeout: 2000 })) !== "true") {
        await pane.click({ timeout: 2000 });
      }
      const editor = panel.locator(".CodeMirror").first();
      // Fails fast if the panel was reset to another tab, so the retry re-switches.
      await expect(editor).toBeVisible({ timeout: 2000 });
      await this.setCodeMirrorValue(editor, value);
    }).toPass({ timeout: 45_000 });
  }
}
