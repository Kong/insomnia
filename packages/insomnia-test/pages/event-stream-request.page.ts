import { expect } from "@playwright/test";

import { ContentType } from "../enums/content-type";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type {
  EventStreamMethod,
  EventStreamRequest,
  EventStreamRequestBody,
} from "../models/event-stream-request";
import { RequestPage } from "./request.page";

export class EventStreamRequestPage extends RequestPage {
  protected readonly urlBarId = "request-url-bar";

  /**
   * Reads the full event-stream request state from the UI (method, url,
   * params, body, and scripts). Headers are always returned empty since
   * event-stream requests don't expose a headers tab.
   * @returns the event-stream request fields, excluding `name`
   */
  async get(): Promise<Omit<EventStreamRequest, "name">> {
    const scripts = await this.getScripts();
    return {
      method: (await this.getMethod()).trim() as EventStreamMethod,
      url: await this.getUrl(),
      params: await this.getParams(),
      headers: [],
      body: await this.getBody(),
      preRequestScript: scripts?.preRequest,
      afterResponseScript: scripts?.afterResponse,
    };
  }

  /**
   * Reads the current body from the content-type body editor.
   * @returns the body's mime type and text, or `undefined` if no body is set
   */
  private async getBody(): Promise<EventStreamRequestBody | undefined> {
    const body = await this.getContentTypeBody(ContentType.NoBody);
    if (!body) return undefined;
    return { mimeType: body.contentType, text: body.content };
  }

  /**
   * Navigates to the event-stream request pane, then installs a
   * `db.changes` listener that increments `window.__saveCount` each time a
   * "Request" document is saved — used by tests to assert save behavior
   * without polling the UI.
   */
  async navigate(): Promise<void> {
    await super.navigate();
    await this.page.evaluate(() => {
      (window as any).__saveCount = 0;
      (window as any).main.on(
        "db.changes",
        (_: unknown, changes: [string, { type: string }][]) => {
          for (const [, doc] of changes) {
            if (doc.type === "Request") {
              (window as any).__saveCount++;
            }
          }
        },
      );
    });
  }

  /**
   * Sets the request body via the content-type body editor. No-ops if the
   * body has no `mimeType`.
   * @param body - the event-stream request body to apply
   */
  async setBody(body: EventStreamRequestBody): Promise<void> {
    if (body.mimeType == null) return;
    await this.setContentTypeBody({
      contentType: body.mimeType,
      content: body.text ?? "",
    });
  }

  /**
   * Waits until the request pane becomes visible.
   */
  async waitForPane(): Promise<void> {
    await expect(this.page.locator(this.PANE)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
