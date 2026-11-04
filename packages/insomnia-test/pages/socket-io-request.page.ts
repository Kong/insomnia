import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { RequestPage } from "./request.page";

export class SocketIORequestPage extends RequestPage {
  protected readonly urlBarId = "websocket-url-bar";
  protected readonly persistedDbFile = "insomnia.SocketIORequest.db";





  /**
   * Clicks Connect and waits for the button to flip to "Disconnect", so a
   * following send doesn't race the handshake and get dropped.
   */
  async connect(): Promise<void> {
    await super.connect();
    await expect(
      this.page
        .locator(this.PANE)
        .getByRole("button", { name: "Disconnect", exact: true }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
