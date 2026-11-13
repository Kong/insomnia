import { ResponseViewerComponent } from '@package/components/response-viewer.component';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '@package/misc/constants';
import type { ResponseHeader, ResponseStatusBar, ResponseTestResult, ResponseView, StreamEvent } from '@package/models/response';
import { expect } from '@playwright/test';

import { BasePage } from './base.page';

export type ResponseTab = 'preview' | 'headers' | 'cookies' | 'test-results' | 'mock-response' | 'timeline' | 'events';

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
  return Math.round(Number.parseFloat(match[1]) * BYTE_UNIT_FACTOR[match[2].toUpperCase()]);
}

export class ResponsePage extends BasePage {
  private readonly EVENT_PREVIEW_EDITOR = '[data-testid="response-pane"] #mcp-data-preview + .CodeMirror';
  private readonly HEADER_TAGS = '[data-testid="response-pane"] [aria-live="polite"]';
  private readonly EVENT_ROWS = '[data-testid="response-pane"] [data-testid="event-row"]';
  private readonly NBSP = / /g;
  private readonly PANE = '[data-testid="response-pane"]';

  private get viewer(): ResponseViewerComponent {
    return new ResponseViewerComponent(this.page);
  }
  private readonly TABPANEL = '[data-testid="response-pane"] [role="tabpanel"]';

  /**
   * Assembles the full response state currently shown in the response
   * pane — status bar, preview, headers, console log, streamed events and
   * script test results.
   */
  async get(): Promise<ResponseView> {
    return {
      statusBar: await this.getStatusBar(),
      headers: (await this.getHeaders()) ?? [],
      preview: await this.getPreview(),
      events: async () => (await this.getEvents()) ?? [],
      console: async () => (await this.getConsole()) ?? '',
      tests: async () => this.getTestResults(),
    };
  }

  /**
   * Reads the content shown on the "preview" tab, parsing it as JSON when
   * possible and falling back to the raw text otherwise.
   */
  private async getPreview(): Promise<unknown> {
    if (!(await this.switchTab('preview'))) return undefined;
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
   */
  private async getBytesContent(): Promise<number | undefined> {
    const tag = this.page.locator(this.HEADER_TAGS).getByTestId('response-size-tag');
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, ' ').trim();
    return parseByteSize(raw);
  }

  /**
   * Reads the request/response console log shown on the "timeline" tab.
   */
  async getConsole(): Promise<string | undefined> {
    if (!(await this.switchTab('timeline'))) return undefined;
    const editor = this.page.locator(`${this.TABPANEL} .CodeMirror`).first();
    await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return this.readCodeMirror(editor);
  }

  /**
   * Reads the response's elapsed-time tag and converts it to
   * milliseconds.
   */
  private async getElapsedTime(): Promise<number | undefined> {
    const tag = this.page.locator(this.HEADER_TAGS).getByTestId('response-time-tag');
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, ' ').trim();
    return parseDurationMs(raw);
  }

  /**
   * Reads the currently selected event's preview content, parsing it as
   * JSON when possible and falling back to the raw text otherwise.
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
   */
  async getEvents(): Promise<StreamEvent[] | undefined> {
    if (!(await this.switchTab('events'))) return undefined;
    const rows = this.page.locator(this.EVENT_ROWS);
    const count = await rows.count();
    const events: StreamEvent[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const data = (await row.getByTestId('event-cell-data').innerText()).trim();
      const time = (await row.getByTestId('event-cell-time').innerText()).trim();
      await rows.nth(i).dispatchEvent('click');
      events.push({ data, time, preview: await this.getEventPreview() });
    }
    return events;
  }

  /**
   * Reads all response headers listed on the "headers" tab.
   */
  private async getHeaders(): Promise<ResponseHeader[] | undefined> {
    if (!(await this.switchTab('headers'))) return undefined;
    return this.page.locator(`${this.TABPANEL} [data-testid="response-header-row"]`).evaluateAll(rows =>
      rows.map(row => ({
        name: (row.querySelector<HTMLElement>('[data-testid="response-header-name"]')?.innerText ?? '').trim(),
        value: (row.querySelector<HTMLElement>('[data-testid="response-header-value"]')?.innerText ?? '').trim(),
      })),
    );
  }

  /**
   * Reads all `insomnia.test`/`insomnia.expect` results listed on the
   * "test-results" tab (populated by pre-request/after-response scripts).
   */
  private async getTestResults(): Promise<ResponseTestResult[] | undefined> {
    if (!(await this.switchTab('test-results'))) return undefined;
    const rows = this.page.locator(`${this.TABPANEL} [data-testid="test-result-row"]`);
    const count = await rows.count();
    const results: ResponseTestResult[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const status = ((await row.getByTestId('test-result-status').textContent()) ?? '').trim();
      const name = ((await row.getByTestId('test-result-case').textContent()) ?? '').trim();
      const errorText = ((await row.getByTestId('test-result-error').textContent()) ?? '').trim();
      const error = errorText || undefined;
      results.push({ name, status, error });
    }
    return results;
  }

  /**
   * Reads the response's HTTP status tag and splits it into a numeric
   * status code and message.
   */
  private async getStatus(): Promise<{ code: number; message: string; text: string } | undefined> {
    const tag = this.page.locator(this.HEADER_TAGS).getByTestId('response-status-tag');
    if ((await tag.count()) === 0) return undefined;
    const raw = (await tag.innerText()).replace(this.NBSP, ' ').trim();
    const [code, ...rest] = raw.split(/\s+/);
    const statusCode = Number(code);
    if (Number.isNaN(statusCode)) return undefined;
    return { code: statusCode, message: rest.join(' '), text: raw };
  }

  /**
   * Gathers the response pane's header bar — status, elapsed time, and
   * byte size — as shown in its header tags.
   */
  private async getStatusBar(): Promise<ResponseStatusBar> {
    const status = await this.getStatus();
    return {
      text: status?.text,
      code: status?.code,
      message: status?.message,
      elapsedTime: await this.getElapsedTime(),
      bytesContent: await this.getBytesContent(),
    };
  }

  /**
   * Confirms the response pane has loaded by waiting for the "Timeline"
   * tab to become visible. If an error dialog (e.g. "The request failed
   * due to an unhandled error") appears instead, throws using its text
   * rather than waiting out the full timeout for a pane that will never
   * render. This covers dialogs slower than `@throwOnDialog`'s short
   * wait on `RequestPage.send()`.
   */
  async navigate(): Promise<void> {
    const previewTab = this.page.locator(`${this.PANE} [data-key="timeline"][role="tab"]`);
    const dialog = this.page.getByRole('dialog').first();
    await previewTab.or(dialog).first().waitFor({ state: 'visible', timeout: LONG_TIMEOUT });
    if (await dialog.isVisible()) {
      throw new Error((await dialog.innerText()).trim());
    }
  }

  private async switchTab(tab: ResponseTab): Promise<boolean> {
    const tabLocator = this.viewer.tabs.tab(tab);
    if ((await tabLocator.count()) === 0) return false;
    await tabLocator.click();
    return true;
  }
}
