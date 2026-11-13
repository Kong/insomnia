import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { throwOnDialog } from "@package/misc/decorators";
import type { GrpcRequestHeader } from "@package/models/grpc-request";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { RequestPage } from "./request.page";

const MESSAGE_TAB_KEY = "method-type";

export class GrpcRequestPage extends RequestPage {
  private readonly GRPC_METHOD_BUTTON = `${this.PANE} button[aria-label="Select gRPC method"]`;
  private readonly METHOD_SELECT = `${this.PANE} [data-testid="hidden-select-container"] select`;
  private readonly SERVER_REFLECTION_BUTTON = `${this.PANE} button[data-testid="button-server-reflection"]`;
  /** Unary reads "Send"; server/client/bidi streaming methods read "Start" until running, then "Cancel". */
  protected override get sendButtonLocator(): Locator {
    return this.page
      .locator(this.PANE)
      .getByRole("button", { name: /^(Send|Start)$/ });
  }
  protected readonly urlBarId = "grpc-url";
  protected readonly persistedDbFile = "insomnia.GrpcRequest.db";
  protected readonly hasTrailingBlankRow = false;
  protected readonly persistedRowPaths = ["metadata"];

  /**
   * Clicks the "Server Reflection" button to fetch methods via reflection.
   */
  @throwOnDialog()
  async fetchServerReflection(): Promise<void> {
    await this.page.locator(this.SERVER_REFLECTION_BUTTON).click();
  }

  /**
   * Reads the gRPC request state from the UI (url, method and headers).
   * The message body is not read back.
   */
  async get(): Promise<{
    url: string;
    method: string;
    headers: GrpcRequestHeader[];
  }> {
    return {
      url: await this.getUrl(),
      method: await this.getMethod(),
      headers: await this.getHeaders(),
    };
  }

  /**
   * Reads the currently selected gRPC method.
   */
  async getMethod(): Promise<string> {
    return this.page.locator(this.METHOD_SELECT).inputValue();
  }

  /**
   * Switches to the message tab and sets the request message body directly
   * via the CodeMirror instance. The app patches this value into the
   * request's state in the background rather than synchronously — callers
   * that depend on the patch having landed must confirm that separately
   * (see `GrpcRequestFlow`'s `waitForBodyPersisted()`).
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
}
