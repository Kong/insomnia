import { expect } from "@playwright/test";
import { RequestPage } from "./request.page";
import { GrpcRequestHeader } from "../models/grpc-request";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { throwOnDialog } from "../misc/decorators";

const MESSAGE_TAB_KEY = "method-type";

export class GrpcRequestPage extends RequestPage {
  private readonly CANCEL_BUTTON = `${this.PANE} button:has-text("Cancel")`;
  private readonly COMMIT_BUTTON = `${this.PANE} button:has-text("Commit")`;
  private readonly GRPC_METHOD_BUTTON = `${this.PANE} button[aria-label="Select gRPC method"]`;
  private readonly MESSAGE_TAB = `${this.PANE} [data-key="${MESSAGE_TAB_KEY}"][role="tab"]`;
  private readonly METHOD_SELECT = `${this.PANE} [data-testid="hidden-select-container"] select`;
  private readonly SERVER_REFLECTION_BUTTON = `${this.PANE} button[data-testid="button-server-reflection"]`;
  private readonly STREAM_BUTTON = `${this.PANE} button:has-text("Stream")`;
  /** Unary reads "Send"; server/client/bidi streaming methods read "Start" until running, then "Cancel". */
  protected readonly SEND_BUTTON = `${this.PANE} button:has-text("Send"), ${this.PANE} button:has-text("Start")`;
  protected readonly urlBarId = "grpc-url";

  /**
   * Cancels the in-flight call: a still-in-flight unary/server-streaming
   * call, or an open client/bidi-streaming call.
   */
  async cancel(): Promise<void> {
    await this.page.locator(this.CANCEL_BUTTON).click();
  }

  /**
   * Closes the client half of an open client-streaming or bidi-streaming
   * call by clicking "Commit", signalling no more messages will be sent.
   * The Commit button only renders on the method-type tab, so this
   * switches there first — it may not be the active tab if `commit()` is
   * called without an intervening `setBody()` (which switches there as a
   * side effect).
   */
  async commit(): Promise<void> {
    await this.switchTab(MESSAGE_TAB_KEY);
    await this.page.locator(this.COMMIT_BUTTON).click();
  }

  /**
   * Clicks the "Server Reflection" button to fetch methods via reflection.
   */
  @throwOnDialog()
  async fetchServerReflection(): Promise<void> {
    await this.page.locator(this.SERVER_REFLECTION_BUTTON).click();
  }

  /**
   * Reads the full gRPC request state from the UI (url, method, body, and
   * headers).
   * @returns the gRPC request's url, method, body, and headers
   */
  async get(): Promise<{
    url: string;
    method: string;
    body?: string;
    headers: GrpcRequestHeader[];
  }> {
    return {
      url: await this.getUrl(),
      method: await this.getMethod(),
      body: await this.getBody(),
      headers: await this.getHeaders(),
    };
  }

  /**
   * Reads the request message body from the message tab, if that tab
   * exists.
   * @returns the message body text, or `undefined` if the message tab isn't present
   */
  async getBody(): Promise<string | undefined> {
    const tab = this.page.locator(this.MESSAGE_TAB);
    if ((await tab.count()) === 0) return undefined;
    await tab.click();
    const editor = this.page.locator(`${this.TABPANEL} .CodeMirror`).first();
    return this.readCodeMirror(editor);
  }

  /**
   * Reads the currently selected gRPC method.
   * @returns the selected method's value
   */
  async getMethod(): Promise<string> {
    return this.page.locator(this.METHOD_SELECT).inputValue();
  }

  /**
   * Switches to the message tab and sets the request message body directly
   * via the CodeMirror instance. The app patches this value into the
   * request's state in the background rather than synchronously — callers
   * that depend on the patch having landed (e.g. before `setHeaders()`, or
   * before `clickStream()`) must confirm that separately, e.g. via
   * `GrpcRequestFlow`'s `waitForBodyPersisted()`.
   * @param content - the message body text to set
   */
  async setBody(content: string): Promise<void> {
    await this.switchTab(MESSAGE_TAB_KEY);
    const editor = this.page.locator(`${this.TABPANEL} .CodeMirror`).first();
    await editor.evaluate((el, value) => {
      (el as any).CodeMirror?.setValue(value);
    }, content);
  }

  /**
   * Selects a gRPC method from the method picker dropdown, waiting for the
   * picker button to become enabled first, then confirms the underlying
   * select reflects the chosen method.
   * @param method - the gRPC method key to select
   */
  async setMethod(method: string): Promise<void> {
    await expect(this.page.locator(this.GRPC_METHOD_BUTTON)).toBeEnabled({
      timeout: DEFAULT_TIMEOUT,
    });
    await this.page.locator(this.GRPC_METHOD_BUTTON).click();
    await this.page
      .locator(`[role="option"][data-key="${method}"]`)
      .dispatchEvent("click");
    await expect(this.page.locator(this.METHOD_SELECT)).toHaveValue(method);
  }

  /**
   * Clicks "Stream" to push the Body tab's current content over an open
   * client-streaming or bidi-streaming call, appending a new read-only
   * "Stream N" tab. Can be called repeatedly after each `setBody()` to
   * stream a new message. Callers must confirm the just-set body has
   * actually persisted before calling this — see `setBody()` — since this
   * button reads the request's patched-in-the-background state rather
   * than the CodeMirror instance directly, and clicking too early streams
   * the previous content.
   */
  async clickStream(): Promise<void> {
    await this.page.locator(this.STREAM_BUTTON).click();
  }
}
