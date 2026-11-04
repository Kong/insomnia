import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { RequestPage } from "./request.page";


export class McpClientPage extends RequestPage {
  private readonly FILTER_INPUT =
    'input[aria-label="Server Capability filter"]';
  protected readonly urlBarId = "mcp-url-bar";

  /**
   * Clicks Disconnect and waits for the button to flip back to "Connect".
   * While connected the whole URL form is `aria-disabled`, which makes
   * Playwright treat the Disconnect button inside it as not enabled even
   * though it is clickable, so the click is dispatched directly instead.
   */
  override async disconnect(
    callback: () => Promise<void> | void = () => {},
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    await expect(async () => {
      await callback();
    }).toPass({ timeout });

    const connectButton = this.page
      .locator(this.PANE)
      .getByRole("button", { name: /^(Connect|Disconnect)$/ });
    await connectButton.dispatchEvent("click");
    await expect(connectButton).toHaveText("Connect", {
      timeout: DEFAULT_TIMEOUT,
    });
  }




  /**
   * Confirms the MCP client request pane has loaded by waiting for the
   * server capability filter input to become visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.FILTER_INPUT)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }



















}
