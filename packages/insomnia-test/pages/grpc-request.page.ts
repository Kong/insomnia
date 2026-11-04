import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { RequestPage } from "./request.page";

export class GrpcRequestPage extends RequestPage {
  private readonly GRPC_METHOD_BUTTON = `${this.PANE} button[aria-label="Select gRPC method"]`;
  private readonly METHOD_SELECT = `${this.PANE} [data-testid="hidden-select-container"] select`;
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
   * Reads the currently selected gRPC method.
   */
  async getMethod(): Promise<string> {
    return this.page.locator(this.METHOD_SELECT).inputValue();
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
