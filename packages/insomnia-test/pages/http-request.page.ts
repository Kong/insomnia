import { expect } from "@playwright/test";

import { ContentType } from "../enums/content-type";
import type { HttpMethod } from "../enums/http-method";
import type {
  HttpRequest,
  HttpRequestBody,
  RequestBodyParameter,
} from "../models/http-request";
import { RequestPage } from "./request.page";

export class HttpRequestPage extends RequestPage {
  protected readonly urlBarId = "request-url-bar";

  /**
   * Assembles the full HTTP request state currently shown in the request
   * pane — method, URL, params, body, and pre-request/after-response
   * scripts. Headers are always returned empty; this page doesn't read
   * them back.
   * @returns The request data, omitting its name
   */
  async get(): Promise<Omit<HttpRequest, "name">> {
    const scripts = await this.getScripts();
    return {
      method: (await this.getMethod()).trim() as HttpMethod,
      url: await this.getUrl(),
      params: await this.getParams(),
      headers: [],
      body: await this.getBody(),
      preRequestScript: scripts?.preRequest,
      afterResponseScript: scripts?.afterResponse,
    };
  }

  /**
   * Reads back the currently configured request body by switching to the
   * "content-type" tab and inspecting the mime type select, then reading
   * the type-specific content — form/multipart params, the chosen file
   * name, or the raw text from the CodeMirror editor.
   * @returns The current body, or undefined when no body is set or no
   * editor is present
   */
  async getBody(): Promise<HttpRequestBody | undefined> {
    await this.switchTab("content-type");
    const panel = this.page.locator(this.TABPANEL);
    const mimeType = await panel
      .locator('[data-testid="hidden-select-container"] select')
      .inputValue();
    if (!mimeType || mimeType === ContentType.NoBody) return undefined;

    if (mimeType === ContentType.Multipart || mimeType === ContentType.Form) {
      return {
        mimeType: mimeType as ContentType,
        params: await this.getBodyParams(),
      };
    }
    if (mimeType === ContentType.File) {
      return {
        mimeType: mimeType as ContentType,
        fileName: await this.getBodyFileName(),
      };
    }

    const editor = panel.locator(".CodeMirror").first();
    if ((await editor.count()) === 0) return undefined;
    return {
      mimeType: mimeType as ContentType,
      text: await this.readCodeMirror(editor),
    };
  }

  /**
   * Sets the request body by first selecting the body's mime type, then
   * filling in the type-specific content — form/multipart parameters, a
   * file path, or raw text typed into the code editor. Does nothing when
   * no mime type is given, and skips content entirely for `NoBody`.
   * @param body - The body to apply, including its mime type and content
   */
  async setBody(body: HttpRequestBody): Promise<void> {
    if (body.mimeType == null) return;
    await this.selectBodyType(body.mimeType);

    if (body.mimeType === ContentType.NoBody) return;

    if (
      body.mimeType === ContentType.Multipart ||
      body.mimeType === ContentType.Form
    ) {
      await this.setBodyParams(body.params ?? []);
      return;
    }

    if (body.mimeType === ContentType.File) {
      if (body.fileName) await this.chooseBodyFile(body.fileName);
      return;
    }

    await this.typeBody(body.text ?? "");
  }

  private async chooseBodyFile(filePath: string): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    await this.stubFileChooser(filePath);
    await panel.locator('button:has-text("Choose File")').click();
  }

  private async getBodyFileName(): Promise<string | undefined> {
    const panel = this.page.locator(this.TABPANEL);
    const text = await panel
      .locator("code")
      .first()
      .innerText()
      .catch(() => "");
    return text || undefined;
  }

  private async getBodyParams(): Promise<RequestBodyParameter[]> {
    const panel = this.page.locator(this.TABPANEL);
    const rows = panel.locator('[role="listbox"] [role="option"]');
    const count = await rows.count();
    const params: RequestBodyParameter[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
      );
      const fileButton = row.locator("button:has(i.fa-file-o)");
      if ((await fileButton.count()) > 0) {
        const fileName =
          (await fileButton.getAttribute("title").catch(() => "")) ||
          undefined;
        if (name || fileName) params.push({ name, fileName });
        continue;
      }
      const value = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
      );
      const toggle = row.locator("button[aria-pressed]");
      const enabled =
        (await toggle.count()) === 0
          ? true
          : (await toggle.getAttribute("aria-pressed")) === "true";
      if (name || value) params.push({ name, value, disabled: !enabled });
    }
    return params;
  }

  private async setBodyParams(params: RequestBodyParameter[]): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    const deleteAllBtn = panel.locator('button:has-text("Delete all")');
    if (await deleteAllBtn.isEnabled()) {
      await deleteAllBtn.click();
    }

    const addBtn = panel.locator('button:has-text("Add")');
    const rows = panel.locator('[role="listbox"] [role="option"]');

    for (const [i, param] of params.entries()) {
      const countBefore = await rows.count();

      if (i > 0 || countBefore === 0) {
        await expect(async () => {
          const before = await rows.count();
          await addBtn.click();
          await expect(rows).toHaveCount(before + 1, { timeout: 1000 });
        }).toPass({ timeout: 10_000 });
      }
      const row = rows.last();
      await this.setCodeMirrorValue(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
        param.name,
      );
      await this.page.waitForTimeout(500);

      if (param.fileName) {
        await row.locator('button[aria-label="Text mode"]').click();
        const fileModeOption = this.page.locator(
          '[role="menuitemradio"][data-key="file"]',
        );
        await expect(fileModeOption).toBeVisible({ timeout: 5000 });
        await fileModeOption.click();
        await this.stubFileChooser(param.fileName);
        await row.locator('button:has-text("Choose File")').click();
      } else {
        await this.setCodeMirrorValue(
          row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
          param.value ?? "",
        );
        await this.page.waitForTimeout(500);
      }

      if (param.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }

      await this.page.waitForTimeout(500);
    }
  }

  private async typeBody(text: string): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    const editor = panel.locator(".CodeMirror").first();
    await this.setCodeMirrorValue(editor, text);
  }
}
