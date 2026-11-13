import type { WebSocketRequest } from "@package/models/websocket-request";

import { RequestPage } from "./request.page";

export class WebSocketRequestPage extends RequestPage {
  protected readonly urlBarId = "websocket-url-bar";
  protected readonly persistedDbFile = "insomnia.WebSocketRequest.db";

  /**
   * Assembles the WebSocket request state currently shown in the request
   * pane — URL, params and headers. The message body is not read back.
   */
  async get(): Promise<Omit<WebSocketRequest, "name" | "body">> {
    return {
      url: await this.getUrl(),
      params: await this.getParams(),
      headers: await this.getHeaders(),
    };
  }
}
