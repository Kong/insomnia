import { RequestPage } from "./request.page";
import { SocketIOMessage, RequestHeader } from "../models/socket-io-request";

export class SocketIORequestPage extends RequestPage {
  protected readonly urlBarId = "websocket-url-bar";

  /**
   * Reads the full Socket.IO request state from the UI (url, headers, and
   * the composed message).
   * @returns the request's url, headers, and message
   */
  async get(): Promise<{
    url: string;
    headers: RequestHeader[];
    message?: SocketIOMessage;
  }> {
    return {
      url: await this.getUrl(),
      headers: await this.getHeaders(),
      message: await this.getMessage(),
    };
  }

  /**
   * Reads the currently composed event name and payload from the body tab.
   * @returns the event name and payload, or `undefined` if both are empty
   */
  private async getMessage(): Promise<SocketIOMessage | undefined> {
    await this.switchTab("body");
    const panel = this.page.locator(this.TABPANEL);
    const eventName = await panel
      .getByRole("textbox", { name: "Event Name" })
      .inputValue();
    const payload = await this.readCodeMirror(
      panel.locator(".CodeMirror").first(),
    );
    if (!eventName && !payload) return undefined;
    return { eventName, payload };
  }

  /**
   * Switches to the body tab and clicks "Send" to emit the composed
   * message.
   */
  async sendMessage(): Promise<void> {
    await this.switchTab("body");
    const panel = this.page.locator(this.TABPANEL);
    await panel.getByRole("button", { name: "Send", exact: true }).click();
  }

  /**
   * Composes a Socket.IO message: switches to the body tab, adds a new
   * argument row via "+ Arg", sets its payload directly on the CodeMirror
   * instance, and fills in the event name.
   * @param message - the event name and payload to set
   */
  async setMessage(message: SocketIOMessage): Promise<void> {
    await this.switchTab("body");
    const panel = this.page.locator(this.TABPANEL);
    await panel.locator('button:has-text("+ Arg")').click();

    const editor = panel.locator(".CodeMirror").first();
    await editor.evaluate((el, value) => {
      (el as any).CodeMirror?.setValue(value);
    }, message.payload);

    await panel
      .getByRole("textbox", { name: "Event Name" })
      .fill(message.eventName);
  }
}
