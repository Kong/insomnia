import { expect } from "@playwright/test";

import type { ImportSource } from "../enums/import-sources";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

export class ImportPage extends BasePage {
  // Renamed from "Select Collection" — INS-3528.
  private readonly COLLECTION_SELECT =
    '[role="dialog"] select[aria-label="Select API Collection"]';
  private readonly CURL_TEXTAREA = '[role="dialog"] textarea[name="curl"]';
  private readonly DIALOG = '[role="dialog"]';
  private readonly FILE_INPUT =
    '[role="dialog"] input[data-test-id="import-file-input"]';
  private readonly HEADER = '[role="dialog"] .modal__header__children';
  private readonly IMPORT_BUTTON = '[role="dialog"] button:has-text("Import")';
  private readonly MCP_URL_INPUT = '[role="dialog"] input[name="mcp"]';
  private readonly PROJECT_SELECT =
    '[role="dialog"] select[aria-label="Select Project"]';
  private readonly SCAN_BUTTON = '[role="dialog"] button:has-text("Scan")';
  private readonly SOURCE_RADIO = (source: ImportSource) =>
    `[role="dialog"] label[data-test-id="import-from-${source}"]`;
  private readonly URL_INPUT = '[role="dialog"] input[name="uri"]';

  async clickImport(): Promise<void> {
    await this.page.locator(this.IMPORT_BUTTON).click();
    await expect(this.page.locator(this.DIALOG)).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async clickScan(): Promise<void> {
    await this.page.locator(this.SCAN_BUTTON).click();
    await expect(this.page.locator(this.PROJECT_SELECT)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async navigate(): Promise<void> {
    await expect(this.page.locator(this.HEADER)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async selectCollection(name: string): Promise<void> {
    const select = this.page.locator(this.COLLECTION_SELECT);
    const value = await select.evaluate(
      (el: HTMLSelectElement, prefix: string) =>
        Array.from(el.options).find((o) => o.text.startsWith(prefix))?.value,
      name,
    );
    await select.selectOption(value!);
  }

  async selectProject(name: string): Promise<void> {
    await this.page.locator(this.PROJECT_SELECT).selectOption({ label: name });
  }

  async selectSource(source: ImportSource): Promise<void> {
    await this.page.locator(this.SOURCE_RADIO(source)).click();
  }

  async setClipboardContent(content: string): Promise<void> {
    await this.page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, content);
  }

  async setCurlCommand(command: string): Promise<void> {
    await this.page.locator(this.CURL_TEXTAREA).fill(command);
  }

  async setFile(filePath: string): Promise<void> {
    await this.page.locator(this.FILE_INPUT).setInputFiles(filePath);
  }

  async setMcpUrl(url: string): Promise<void> {
    await this.page.locator(this.MCP_URL_INPUT).fill(url);
  }

  async setUrl(url: string): Promise<void> {
    await this.page.locator(this.URL_INPUT).fill(url);
  }
}
