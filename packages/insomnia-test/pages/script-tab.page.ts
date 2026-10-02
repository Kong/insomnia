import { ScriptTab } from "../enums/script-tab";
import { TabPanelPage } from "./tab-panel.page";

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
export class ScriptTabComponent extends TabPanelPage {
  protected readonly AFTER_RESPONSE_EDITOR = "div[data-key='after-response']";
  protected readonly PRE_REQUEST_EDITOR = "div[data-key='pre-request']";

  /**
   * Reads back both the pre-request and after-response scripts by
   * switching to each script's editor pane in turn. Returns undefined
   * if both scripts are empty.
   * @returns The current script(s), or undefined if neither script has content
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
   * @param scripts - The script(s) to set
   */
  async setScripts(scripts: RequestScripts): Promise<void> {
    await this.switchTab("scripts");
    const panel = this.page.locator(this.TABPANEL);
    if (scripts.preRequest) {
      const preEditor = panel.locator(this.PRE_REQUEST_EDITOR);
      await preEditor.isVisible();
      await preEditor.click();

      const editor = panel.locator(".CodeMirror").first();
      await this.setCodeMirrorValue(editor, scripts.preRequest);
    }
    if (scripts.afterResponse) {
      const afterEditor = panel.locator(this.AFTER_RESPONSE_EDITOR);
      await afterEditor.isVisible();
      await afterEditor.click();

      const editor = panel.locator(".CodeMirror").first();
      await this.setCodeMirrorValue(editor, scripts.afterResponse);
    }
  }

  /**
   * Types into the Scripts tab's Pre-request and/or After-response
   * editors via real keystrokes (rather than replacing the value
   * outright like `setScripts()`), so it builds genuine CodeMirror undo
   * history the way a user's typing would. Only scripts that are
   * provided are typed into.
   * @param scripts - The script(s) to type at the end of their current content
   */
  async typeScripts(scripts: RequestScripts): Promise<void> {
    if (scripts.preRequest) {
      await this.switchScriptTab(ScriptTab.PreRequest);
      const panel = this.page.locator(this.TABPANEL);
      const editor = panel.locator(".CodeMirror").first();
      await editor.click();
      await this.page.keyboard.press("End");
      await this.page.keyboard.type(scripts.preRequest);
      await this.page.waitForTimeout(500);
    }
    if (scripts.afterResponse) {
      await this.switchScriptTab(ScriptTab.AfterResponse);
      const panel = this.page.locator(this.TABPANEL);
      const editor = panel.locator(".CodeMirror").first();
      await editor.click();
      await this.page.keyboard.press("End");
      await this.page.keyboard.type(scripts.afterResponse);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Switches to the Scripts tab's Pre-request or After-response sub-tab,
   * clicks into its editor, and sends the platform's Undo shortcut
   * (Cmd+Z on macOS, Ctrl+Z elsewhere).
   * @param which - Which script's editor to undo in
   */
  async undoScript(which: ScriptTab): Promise<void> {
    await this.switchScriptTab(which);
    const panel = this.page.locator(this.TABPANEL);
    const editor = panel.locator(".CodeMirror").first();
    await this.undo(() => editor.click());
  }

  /**
   * Switches to the Scripts tab, then to the given script's own sub-tab.
   * @param which - Which script's sub-tab to switch to
   */
  async switchScriptTab(which: ScriptTab): Promise<void> {
    await this.switchTab("scripts");
    const panel = this.page.locator(this.TABPANEL);
    const editorSelector =
      which === ScriptTab.PreRequest
        ? this.PRE_REQUEST_EDITOR
        : this.AFTER_RESPONSE_EDITOR;
    await panel.locator(editorSelector).click();
  }
}
