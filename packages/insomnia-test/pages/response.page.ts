import { expect } from "@playwright/test";

import { SendButtonState } from "../enums/send-button-state";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type {
  Response,
  ResponseHeader,
  ResponseTestResult,
  StreamEvent,
} from "../models/response";
import { BasePage } from "./base.page";

export type ResponseTab =
  | "preview"
  | "headers"
  | "cookies"
  | "test-results"
  | "mock-response"
  | "timeline"
  | "events";

const DURATION_UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000 };
const BYTE_UNIT_FACTOR: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
};

function parseDurationMs(raw: string): number | undefined {
  const match = raw.match(/^([\d.]+)\s*(ms|s|m)$/i);
  if (!match) return undefined;
  return Number.parseFloat(match[1]) * DURATION_UNIT_MS[match[2].toLowerCase()];
}

function parseByteSize(raw: string): number | undefined {
  const match = raw.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return undefined;
  return Math.round(
    Number.parseFloat(match[1]) * BYTE_UNIT_FACTOR[match[2].toUpperCase()],
  );
}

export class ResponsePage extends BasePage {
  private readonly CANCEL_REQUEST_BUTTON =
    '[data-testid="response-pane"] button:has-text("Cancel Request")';
  private readonly EVENT_PREVIEW_EDITOR =
    '[data-testid="response-pane"] #mcp-data-preview + .CodeMirror';
  private readonly EVENT_ROWS =
    '[data-testid="response-pane"] [role="tabpanel"] table tbody tr';
  private readonly HEADER_TAGS =
    '[data-testid="response-pane"] [aria-live="polite"] .tag';
  private readonly NBSP = / /g;
  private readonly PANE = '[data-testid="response-pane"]';
  private readonly TABPANEL = '[data-testid="response-pane"] [role="tabpanel"]';

  /**
   * Assembles the full response state currently shown in the response
   * pane — summary stats, streamed events, headers, console log, and
   * body.
   * @returns The complete response data
   */
  async get(): Promise<Response> {
    return {
      ...(await this.getSummary()),
      headers: (await this.getHeaders()) ?? [],
      body: await this.getBody(),
      events: async () => (await this.getEvents()) ?? [],
      console: async () => (await this.getConsole()) ?? "",
      tests: async () => this.getTestResults(),
    };
  }

  /**
   * Reads the response body shown on the "preview" tab, parsing it as
   * JSON when possible and falling back to the raw text otherwise.
   * @returns The parsed (or raw) response body, or undefined when the
   * "preview" tab or its editor isn't available
   */
  private async getBody(): Promise<unknown> {
    if (!(await this.switchTab("preview"))) return undefined;
    const editor = this.page.locator(`${this.TABPANEL} .CodeMirror`).first();
    if ((await editor.count()) === 0) return undefined;
    await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const raw = await this.readCodeMirror(editor);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Reads the response's size tag and converts it to bytes.
   * @returns The response size in bytes, or undefined when the tag is
   * missing or unparseable
   */
  private async getBytesContent(): Promise<number | undefined> {
    const tag = this.page.locator(this.HEADER_TAGS).nth(2);
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, " ").trim();
    return parseByteSize(raw);
  }

  /**
   * Reads the request/response console log shown on the "timeline" tab.
   * @returns The console log text, or undefined when the "timeline" tab
   * isn't available
   */
  async getConsole(): Promise<string | undefined> {
    if (!(await this.switchTab("timeline"))) return undefined;
    const editor = this.page.locator(`${this.TABPANEL} .CodeMirror`).first();
    await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return this.readCodeMirror(editor);
  }

  /**
   * Reads the response's elapsed-time tag and converts it to
   * milliseconds.
   * @returns The elapsed time in milliseconds, or undefined when the tag
   * is missing or unparseable
   */
  private async getElapsedTime(): Promise<number | undefined> {
    const tag = this.page.locator(this.HEADER_TAGS).nth(1);
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, " ").trim();
    return parseDurationMs(raw);
  }

  /**
   * Reads the currently selected event's preview content, parsing it as
   * JSON when possible and falling back to the raw text otherwise.
   * @returns The parsed (or raw) preview content, or undefined when no
   * preview editor is present
   */
  private async getEventPreview(): Promise<unknown> {
    const editor = this.page.locator(this.EVENT_PREVIEW_EDITOR);
    if ((await editor.count()) === 0) return undefined;
    const raw = await this.readCodeMirror(editor);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Reads all streamed events from the "events" tab. Each row is clicked
   * in turn (which updates the preview editor) so its preview payload can
   * be captured alongside its data and time columns.
   * @returns The list of stream events, or undefined when the "events"
   * tab isn't available
   */
  async getEvents(): Promise<StreamEvent[] | undefined> {
    if (!(await this.switchTab("events"))) return undefined;
    const rows = this.page.locator(this.EVENT_ROWS);
    const count = await rows.count();
    const events: StreamEvent[] = [];
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator("td");
      const data = (await cells.nth(1).innerText()).trim();
      const time = (await cells.nth(2).innerText()).trim();
      await rows.nth(i).dispatchEvent("click");
      events.push({ data, time, preview: await this.getEventPreview() });
    }
    return events;
  }

  /**
   * Reads a specific streamed gRPC response message by clicking its
   * "Response N" tab and parsing the editor content as JSON, falling back
   * to the raw text when it isn't valid JSON.
   * @param index - The zero-based index of the response message to read
   * @returns The parsed (or raw) message content, or undefined when the
   * tab doesn't exist
   */
  async getGrpcMessage(index = 0): Promise<unknown> {
    const tab = this.page
      .locator(`${this.PANE} [role="tab"]`)
      .filter({ hasText: new RegExp(`^Response ${index + 1}$`) });
    if ((await tab.count()) === 0) return undefined;
    await tab.click();
    const editor = this.page
      .locator(`${this.PANE} [role="tabpanel"] .CodeMirror`)
      .first();
    const raw = await this.readCodeMirror(editor);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Reads every streamed gRPC response message, in order, by walking
   * "Response N" tabs until one doesn't exist. Works uniformly for unary
   * (a single "Response 1" tab) and server/client/bidi-streaming calls
   * (one tab per message received).
   * @returns The parsed (or raw) content of each response message
   */
  async getGrpcMessages(): Promise<unknown[]> {
    const messages: unknown[] = [];
    for (let index = 0; ; index++) {
      const message = await this.getGrpcMessage(index);
      if (message === undefined) break;
      messages.push(message);
    }
    return messages;
  }

  /**
   * Reads the gRPC response status tag and splits it into a status code
   * and message.
   * @returns The gRPC status code and message, or undefined when no
   * status tag is present
   */
  async getGrpcStatus(): Promise<
    { code: string; message: string } | undefined
  > {
    const tag = this.page.locator(
      `${this.PANE} [data-testid="response-status-tag"]`,
    );
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, " ").trim();
    const [code, ...rest] = raw.split(/\s+/);
    return { code, message: rest.join(" ") };
  }

  /**
   * Reads all response headers listed on the "headers" tab.
   * @returns The list of response headers, or undefined when the
   * "headers" tab isn't available
   */
  private async getHeaders(): Promise<ResponseHeader[] | undefined> {
    if (!(await this.switchTab("headers"))) return undefined;
    const rows = this.page.locator(`${this.TABPANEL} table tbody tr`);
    const count = await rows.count();
    const headers: ResponseHeader[] = [];
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator("td");
      headers.push({
        name: (await cells.nth(0).innerText()).trim(),
        value: (await cells.nth(1).innerText()).trim(),
      });
    }
    return headers;
  }

  /**
   * Reads all `insomnia.test`/`insomnia.expect` results listed on the
   * "test-results" tab (populated by pre-request/after-response scripts).
   * @returns The list of test results, or undefined when the
   * "test-results" tab isn't available
   */
  private async getTestResults(): Promise<ResponseTestResult[] | undefined> {
    if (!(await this.switchTab("test-results"))) return undefined;
    const rows = this.page.locator(
      `${this.TABPANEL} [data-testid="test-result-row"]`,
    );
    const count = await rows.count();
    const results: ResponseTestResult[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const status = (
        (await row.locator("span.mr-2.ml-2").textContent()) ?? ""
      ).trim();
      const name = (
        (await row.locator("span.capitalize").textContent()) ?? ""
      ).trim();
      const errorSpan = row.locator("span.capitalize + span.text-neutral-400");
      const error =
        (await errorSpan.count()) > 0
          ? ((await errorSpan.textContent()) ?? "").trim() || undefined
          : undefined;
      results.push({ name, status, error });
    }
    return results;
  }

  /**
   * Clicks "Cancel Request" while a request is in flight.
   */
  async cancelRequest(): Promise<void> {
    await this.page.locator(this.CANCEL_REQUEST_BUTTON).click();
  }

  /**
   * Reports whether text (e.g. `"Request was cancelled"`, `"Executing
   * script timeout"`) is currently visible anywhere in the response pane.
   * @param text - The exact text to look for
   */
  async hasMessage(text: string): Promise<boolean> {
    return this.page.locator(this.PANE).getByText(text).first().isVisible();
  }

  async getSendButtonState(): Promise<SendButtonState> {
    const cancelButton = this.page.locator(this.CANCEL_REQUEST_BUTTON);
    if ((await cancelButton.count()) === 0) return SendButtonState.Idle;
    return (await cancelButton.first().isVisible())
      ? SendButtonState.Sending
      : SendButtonState.Idle;
  }

  /**
   * Reads the response's HTTP status tag and splits it into a numeric
   * status code and message.
   * @returns The status code and message, or undefined when no status
   * tag is present or the code isn't numeric
   */
  private async getStatus(): Promise<
    { code: number; message: string } | undefined
  > {
    const tag = this.page.locator(this.HEADER_TAGS).nth(0);
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, " ").trim();
    const [code, ...rest] = raw.split(/\s+/);
    const statusCode = Number(code);
    if (Number.isNaN(statusCode)) return undefined;
    return { code: statusCode, message: rest.join(" ") };
  }

  /**
   * Gathers the response's headline stats — status code, status message,
   * elapsed time, and byte size — as shown in the response pane's header
   * tags.
   * @returns The response summary fields
   */
  private async getSummary(): Promise<
    Pick<
      Response,
      "statusCode" | "statusMessage" | "elapsedTime" | "bytesContent"
    >
  > {
    const status = await this.getStatus();
    return {
      statusCode: status?.code,
      statusMessage: status?.message,
      elapsedTime: await this.getElapsedTime(),
      bytesContent: await this.getBytesContent(),
    };
  }

  /**
   * Confirms the response pane has loaded by waiting for the "Timeline"
   * tab to become visible.
   */
  async navigate(): Promise<void> {
    const previewTab = this.page.locator(
      `${this.PANE} [data-key="timeline"][role="tab"]`,
    );
    await expect(previewTab).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Confirms a gRPC response has been rendered by waiting for the
   * response status tag to become visible.
   */
  async navigateGrpc(): Promise<void> {
    const statusTag = this.page.locator(
      `${this.PANE} [data-testid="response-status-tag"]`,
    );
    await expect(statusTag).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  private async switchTab(tab: ResponseTab): Promise<boolean> {
    const tabLocator = this.page.locator(
      `${this.PANE} [data-key="${tab}"][role="tab"]`,
    );
    if ((await tabLocator.count()) === 0) return false;
    await tabLocator.click();
    return true;
  }
}
