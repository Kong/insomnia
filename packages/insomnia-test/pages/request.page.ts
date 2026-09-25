import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  RequestHeader,
  RequestParameter,
} from "insomnia-data";

import type { HttpMethod } from "../enums/http-method";
import { ScriptTab } from "../enums/script-tab";
import { throwOnDialog } from "../misc/decorators";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { AuthTabPage } from "./auth-tab.page";

interface KeyValuePair {
  name: string;
  value: string;
  disabled?: boolean;
}

export interface RequestBody {
  contentType: string;
  content: string;
}

export interface RequestScripts {
  preRequest?: string;
  afterResponse?: string;
}

export abstract class RequestPage extends AuthTabPage {
  protected readonly AFTER_RESPONSE_EDITOR = "div[data-key='after-response']";
  protected readonly METHOD_BUTTON =
    '[data-testid="request-pane"] button[aria-label="Request Method"]';
  protected readonly ONE_LINE_EDITOR = '[data-testid="OneLineEditor"]';
  protected readonly PANE = '[data-testid="request-pane"]';
  protected readonly PRE_REQUEST_EDITOR = "div[data-key='pre-request']";
  protected readonly SEND_BUTTON: string =
    '[data-testid="request-pane"] button:has-text("Send")';

  protected abstract readonly urlBarId: string;

  /**
   * Builds the CSS selector for this request type's URL bar CodeMirror
   * editor, using the subclass-provided urlBarId to disambiguate between
   * request protocols.
   * @returns The CSS selector for the URL bar's CodeMirror editor
   */
  protected get URL_BAR(): string {
    return `${this.PANE} #${this.urlBarId} + .CodeMirror`;
  }

  /**
   * The URL bar editor's container element — the app sets a
   * `data-focused` attribute on this element on focus/blur, so pass this
   * to BasePage's hasFocus() to check whether the URL bar is focused.
   */
  get urlBarContainer(): Locator {
    return this.page.locator(
      `${this.PANE} .editor__container:has(#${this.urlBarId})`,
    );
  }

  /**
   * The Send button — a plain DOM button, not a CodeMirror editor, so
   * pass this to BasePage's isFocused() (not hasFocus()) to check focus.
   */
  get sendButton(): Locator {
    return this.page.locator(this.SEND_BUTTON);
  }

  /**
   * Clicks the Connect/Disconnect button to open a connection (for
   * streaming request types) and waits for it to flip to "Disconnect".
   */
  async connect(): Promise<void> {
    const connectButton = this.page
      .locator(this.PANE)
      .getByRole("button", { name: /^(Connect|Disconnect)$/ });
    await connectButton.click();
  }

  /**
   * Runs the given callback (e.g. to perform assertions or actions while
   * connected) until it passes within the timeout, then clicks the
   * Connect/Disconnect button to close the connection and waits for it
   * to flip back to "Connect".
   * @param callback - A callback retried via expect().toPass() before disconnecting
   * @param timeout - The maximum time to retry the callback, in milliseconds
   */
  async disconnect(
    callback: () => Promise<void> | void = () => {},
    timeout = 5000,
  ): Promise<void> {
    await expect(async () => {
      await callback();
    }).toPass({ timeout });

    const connectButton = this.page
      .locator(this.PANE)
      .getByRole("button", { name: /^(Connect|Disconnect)$/ });
    await connectButton.click();
    await expect(connectButton).toHaveText("Connect", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads back the currently selected body content type and its
   * content. Returns undefined when no body type is selected or the
   * selected type matches the given "no body" sentinel value.
   * @param noBodyValue - The select value representing "no body" for this request type
   * @returns The current content type and content, or undefined if there is no body
   */
  protected async getContentTypeBody(
    noBodyValue: string,
  ): Promise<RequestBody | undefined> {
    await this.page
      .locator(`${this.PANE} [data-key="content-type"][role="tab"]`)
      .click();
    const panel = this.page.locator(this.TABPANEL);
    const raw = await panel
      .locator('[data-testid="hidden-select-container"] select')
      .inputValue();
    if (!raw || raw === noBodyValue) return undefined;
    const editor = panel.locator(".CodeMirror").first();
    if ((await editor.count()) === 0) return undefined;
    const content = await this.readCodeMirror(editor);
    return { contentType: raw, content };
  }

  /**
   * Reads back the request's current headers.
   * @returns The current headers
   */
  async getHeaders(): Promise<RequestHeader[]> {
    return this.readKeyValuePairs("headers");
  }

  /**
   * Switches to the params tab and clicks its "Add" button, appending a
   * new blank row.
   * @returns The new row's Name editor container — pass to hasFocus() to check whether it auto-focused
   */
  async addParam(): Promise<Locator> {
    return this.clickAddButton("params");
  }

  /**
   * Switches to the headers tab and clicks its "Add" button, appending a
   * new blank row.
   * @returns The new row's Name editor container — pass to hasFocus() to check whether it auto-focused
   */
  async addHeader(): Promise<Locator> {
    return this.clickAddButton("headers");
  }

  /**
   * Switches to the given tab and clicks its key/value editor's "Add"
   * button, appending a new blank row.
   * @param tab - The data-key of the tab containing the key/value editor
   * @returns The new row's Name editor container element
   */
  private async clickAddButton(tab: string): Promise<Locator> {
    await this.switchTab(tab);
    const panel = this.page.locator(this.TABPANEL);
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    const rows = panel.locator('[role="listbox"] [role="option"]');
    return rows.last().locator(".editor__container").first();
  }

  /**
   * Switches to the params tab and clicks "Import from URL", which parses
   * the URL bar's current query string into structured params rows and
   * strips the query string off the URL bar.
   */
  async importParamsFromUrl(): Promise<void> {
    await this.switchTab("params");
    await this.page
      .locator(this.PANE)
      .getByRole("button", { name: "Import from URL" })
      .click();
  }

  /**
   * Reads the currently selected request method from the method button.
   * @returns The current method text
   */
  async getMethod(): Promise<string> {
    return this.page.locator(this.METHOD_BUTTON).innerText();
  }

  /**
   * Reads back the request's current query parameters.
   * @returns The current parameters
   */
  async getParams(): Promise<RequestParameter[]> {
    return this.readKeyValuePairs("params");
  }

  /**
   * Reads back both the pre-request and after-response scripts by
   * switching to each script's editor pane in turn. Returns undefined
   * if both scripts are empty.
   * @returns The current script(s), or undefined if neither script has content
   */
  protected async getScripts(): Promise<RequestScripts | undefined> {
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
   * Reads the current value of the URL bar's CodeMirror editor. Confirmed
   * live: right after re-navigating to a just-created/edited request (e.g.
   * `HttpRequestFlow.create()`'s own read-back), the URL bar's CodeMirror
   * instance can still be mid-remount — reading through immediately can
   * race that and observe no instance at all, not merely a stale value —
   * so this polls until an instance is actually attached before reading it.
   * @returns The current URL text
   */
  async getUrl(): Promise<string> {
    const urlBar = this.page.locator(this.URL_BAR);
    await expect(async () => {
      const attached = await urlBar.evaluate((el) => !!(el as any).CodeMirror);
      expect(attached).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return urlBar.evaluate((el) => (el as any).CodeMirror.getValue());
  }

  /**
   * Waits for the request pane to become visible, confirming a request
   * has been opened.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.PANE)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads back all key/value pairs currently shown on the given tab,
   * including each row's enabled/disabled toggle state. Rows with no
   * toggle button are treated as always enabled.
   * @param tab - The data-key of the tab containing the key/value editor
   * @returns The pairs currently present, skipping rows with an empty name and value
   */
  protected async readKeyValuePairs(tab: string): Promise<KeyValuePair[]> {
    await this.page
      .locator(`${this.PANE} [data-key="${tab}"][role="tab"]`)
      .click();
    const panel = this.page.locator(this.TABPANEL);
    const rows = panel.locator('[role="listbox"] [role="option"]');
    const count = await rows.count();
    const pairs: KeyValuePair[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
      );
      const value = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
      );
      const toggle = row.locator("button[aria-pressed]");
      const enabled =
        (await toggle.count()) === 0
          ? true
          : (await toggle.getAttribute("aria-pressed")) === "true";
      if (name || value) pairs.push({ name, value, disabled: !enabled });
    }
    return pairs;
  }

  /**
   * Switches to the content-type tab and selects the given body type
   * from the "Change Body Type" dropdown.
   * @param contentType - The data-key of the body type option to select
   */
  protected async selectBodyType(contentType: string): Promise<void> {
    await this.switchTab("content-type");
    const panel = this.page.locator(this.TABPANEL);
    const select = panel.locator(
      '[data-testid="hidden-select-container"] select',
    );
    await expect(async () => {
      const button = panel.locator('button[aria-label="Change Body Type"]');
      await button.click();
      await this.page
        .locator(`[role="option"][data-key="${contentType}"]`)
        .dispatchEvent("click");
      await expect(select).toHaveValue(contentType, { timeout: 1000 });
    }).toPass({ timeout: 10_000 });
  }

  /**
   * Clicks the Send button to fire the request.
   */
  @throwOnDialog()
  async send(): Promise<void> {
    await this.page.locator(this.SEND_BUTTON).click();
  }

  /**
   * Sets the request body: selects the given content type, then writes
   * the body content into the CodeMirror editor if one is present for
   * that body type (some body types, e.g. "No Body", have no editor).
   * @param body - The content type and content to set
   */
  protected async setContentTypeBody(body: RequestBody): Promise<void> {
    await this.selectBodyType(body.contentType);

    const panel = this.page.locator(this.TABPANEL);
    const editor = panel.locator(".CodeMirror").first();
    if ((await editor.count()) === 0) return;
    await this.setCodeMirrorValue(editor, body.content);
  }

  /**
   * Sets the request's headers.
   * @param headers - The headers to set
   */
  async setHeaders(headers: RequestHeader[]): Promise<void> {
    await this.setKeyValuePairs("headers", headers);
  }

  /**
   * Replaces the key/value pairs shown on the given tab (e.g. params or
   * headers): switches to the tab, clears all existing rows via "Delete
   * all" if enabled, then adds a new row per pair, filling its name and
   * value editors and toggling it off if marked disabled. Waits between
   * edits since new rows are appended asynchronously.
   * @param tab - The data-key of the tab containing the key/value editor
   * @param pairs - The pairs to set, replacing any existing ones
   */
  protected async setKeyValuePairs(
    tab: string,
    pairs: KeyValuePair[],
  ): Promise<void> {
    await this.switchTab(tab);
    const panel = this.page.locator(this.TABPANEL);
    const deleteAllBtn = panel.locator('button:has-text("Delete all")');
    if (await deleteAllBtn.isEnabled()) {
      await deleteAllBtn.click();
    }
    const listbox = panel.locator('[role="listbox"]');
    for (const pair of pairs) {
      const key = await listbox
        .locator('[role="option"]')
        .last()
        .getAttribute("data-key");
      const row = listbox.locator(`[role="option"][data-key="${key}"]`);
      await this.setCodeMirrorValue(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
        pair.name,
      );
      await this.page.waitForTimeout(500);
      await this.setCodeMirrorValue(
        row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
        pair.value,
      );
      if (pair.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Opens the request method dropdown and selects the given method,
   * then waits for the method button to reflect the new selection.
   * @param method - The HTTP method name to select
   */
  async setMethod(method: HttpMethod): Promise<void> {
    await this.page.locator(this.METHOD_BUTTON).click();
    await this.page
      .getByRole("menuitem", { name: method, exact: true })
      .click();
    await expect(this.page.locator(this.METHOD_BUTTON)).toHaveText(method);
  }

  /**
   * Sets the request's query parameters.
   * @param params - The parameters to set
   */
  async setParams(params: RequestParameter[]): Promise<void> {
    await this.setKeyValuePairs("params", params);
  }

  /**
   * Sets the request's pre-request and/or after-response scripts,
   * switching to each script's editor pane before writing into it. Only
   * scripts that are provided are written.
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
   * Sets the request URL by writing into the URL bar's CodeMirror editor.
   * `setCodeMirrorValue()` itself now handles retrying past a revert
   * (e.g. a `{{ }}`/`{% %}` tag's inline widget redrawing and racing the
   * value back to its old content shortly after the write) — a caller
   * that immediately re-navigates (e.g. `HttpRequestFlow.create()`'s own
   * read-back right after also setting the body) could otherwise observe
   * this field having raced back to empty.
   *
   * This only confirms the live editor value, not that it has been
   * persisted to disk — see `HttpRequestFlow`/`GrpcRequestFlow`'s
   * `waitForUrlPersisted()` for that separate, stricter check.
   * @param url - The URL value to set
   */
  async setUrl(url: string): Promise<void> {
    await this.setCodeMirrorValue(this.page.locator(this.URL_BAR), url);
  }

  /**
   * Clicks into the URL bar, moves the cursor to the end, and types the
   * given text via real keystrokes (rather than replacing the value
   * outright like setUrl()), so it builds genuine CodeMirror undo
   * history the way a user's typing would.
   * @param text - The text to type at the end of the current URL
   */
  async typeUrl(text: string): Promise<void> {
    const urlBar = this.page.locator(this.URL_BAR);
    await urlBar.click();
    await this.page.keyboard.press("End");
    await this.page.keyboard.type(text);
  }

  /**
   * Clicks into the URL bar and sends the platform's Undo shortcut
   * (Cmd+Z on macOS, Ctrl+Z elsewhere).
   */
  async undoUrl(): Promise<void> {
    await this.undo(() => this.page.locator(this.URL_BAR).click());
  }

  /**
   * Reads the resolved-value tooltip (`title`) off the first environment
   * variable tag rendered inline in the URL bar, e.g. `{{ _.exampleString }}`.
   * Empty string if no tag is currently rendered there.
   * @returns The tag's currently rendered preview text
   */
  async getUrlPreview(): Promise<string> {
    const tag = this.page.locator(`${this.URL_BAR} .nunjucks-tag`).first();
    return (await tag.count()) === 0 ? "" : (await tag.getAttribute("title")) ?? "";
  }

  /**
   * Switches to the Docs tab and clicks the Markdown editor's Write or
   * Preview sub-tab.
   * @param mode - The sub-tab to switch to
   */
  async setDocsMode(mode: "write" | "preview"): Promise<void> {
    await this.switchTab("docs");
    await this.page
      .locator(`${this.TABPANEL} [data-key="${mode}"][role="tab"]`)
      .click();
  }

  /**
   * Reads the current value of the Docs tab's Markdown editor.
   * @returns The current docs text, or an empty string if the editor instance is not found
   */
  async getDocs(): Promise<string> {
    await this.switchTab("docs");
    return this.readCodeMirror(
      this.page.locator(this.TABPANEL).locator(".CodeMirror").first(),
    );
  }

  /**
   * Switches to the Docs tab's Write sub-tab, clicks into its Markdown
   * editor, moves the cursor to the end, and types the given text via
   * real keystrokes (rather than replacing the value outright), so it
   * builds genuine CodeMirror undo history the way a user's typing would.
   * @param text - The text to type at the end of the current docs content
   */
  async typeDocs(text: string): Promise<void> {
    await this.setDocsMode("write");
    const editor = this.page.locator(this.TABPANEL).locator(".CodeMirror").first();
    await editor.click();
    await this.page.keyboard.press("End");
    await this.page.keyboard.type(text);
    await this.page.waitForTimeout(500);
  }

  /**
   * Clicks into the Docs tab's Markdown editor and sends the platform's
   * Undo shortcut (Cmd+Z on macOS, Ctrl+Z elsewhere).
   */
  async undoDocs(): Promise<void> {
    const editor = this.page.locator(this.TABPANEL).locator(".CodeMirror").first();
    await this.undo(() => editor.click());
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
