import { expect } from "@playwright/test";
import { RequestPage } from "./request.page";
import {
  WebSocketRequest,
  WebSocketRequestBody,
} from "../models/websocket-request";
import { ContentType } from "../enums/content-type";

export class WebSocketRequestPage extends RequestPage {
  protected readonly urlBarId = "websocket-url-bar";

  /**
   * Assembles the full WebSocket request state currently shown in the
   * request pane — URL, params, headers, and body.
   * @returns The request data, omitting its name
   */
  async get(): Promise<Omit<WebSocketRequest, "name">> {
    return {
      url: await this.getUrl(),
      params: await this.getParams(),
      headers: await this.getHeaders(),
      body: await this.getBody(),
    };
  }

  /**
   * Reads back the currently configured WebSocket message body, treating
   * an empty/blank content as no body at all.
   * @returns The current body, or undefined when there's no content
   */
  private async getBody(): Promise<WebSocketRequestBody | undefined> {
    const body = (await this.getContentTypeBody(ContentType.NoBody)) as
      WebSocketRequestBody | undefined;
    if (body && !body.content) return undefined;
    return body;
  }

  /**
   * Sends a message over an already-open connection: the message composer
   * (the "Body" tab) keeps its own "Send" button available post-connect,
   * so this can be called repeatedly with different bodies. `callback` runs
   * while the connection is still open, for asserting the echo arrives.
   */
  async sendMessage(
    body: WebSocketRequestBody,
    callback: () => Promise<void> | void = () => {},
    timeout: number = 5000,
  ): Promise<void> {
    await this.setBody(body);
    await this.send();
    await expect(async () => {
      await callback();
    }).toPass({ timeout });
  }

  /**
   * Sets the WebSocket message body via the shared content-type body
   * handling on the base request page.
   * @param body - The body to apply
   */
  async setBody(body: WebSocketRequestBody): Promise<void> {
    await this.setContentTypeBody(body);
  }
}
