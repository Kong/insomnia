import { FileInputComponent } from "@package/components/file-input.component";
import { SelectComponent } from "@package/components/select.component";
import { ContentType } from "@package/enums/content-type";
import type { HttpMethod } from "@package/enums/http-method";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type {
  HttpRequest,
  HttpRequestBody,
  RequestBodyParameter,
} from "@package/models/http-request";
import { expect } from "@playwright/test";

import { RequestPage } from "./request.page";

export class HttpRequestPage extends RequestPage {
  protected readonly urlBarId = "request-url-bar";

  /**
   * Assembles the full HTTP request state currently shown in the request
   * pane — method, URL, params, body, and pre-request/after-response
   * scripts. Headers are always returned empty; this page doesn't read
   * them back.
   */
  async get(): Promise<Omit<HttpRequest, "name">> {
    const scripts = await this.scripts.getScripts();
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
   */
  async getBody(): Promise<HttpRequestBody | undefined> {
    await this.switchTab("content-type");
    const panel = this.page.locator(this.TABPANEL);
    const mimeType = await new SelectComponent(this.page, panel).nativeValue(
      panel,
    );
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
   * `stubFileChooser` is called with a file path right before its native
   * file picker opens, so the caller can stub the dialog to return it.
   */
  async setBody(
    body: HttpRequestBody,
    stubFileChooser: (filePath: string) => Promise<void>,
  ): Promise<void> {
    if (body.mimeType == null) return;
    await this.selectBodyType(body.mimeType);

    if (body.mimeType === ContentType.NoBody) return;

    if (
      body.mimeType === ContentType.Multipart ||
      body.mimeType === ContentType.Form
    ) {
      await this.setBodyParams(body.params ?? [], stubFileChooser);
      return;
    }

    if (body.mimeType === ContentType.File) {
      if (body.fileName) await this.chooseBodyFile(body.fileName, stubFileChooser);
      return;
    }

    await this.typeBody(body.text ?? "");
  }

  private async chooseBodyFile(
    filePath: string,
    stubFileChooser: (filePath: string) => Promise<void>,
  ): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    await stubFileChooser(filePath);
    await new FileInputComponent(this.page, panel).choose();
  }

  private async getBodyFileName(): Promise<string | undefined> {
    const panel = this.page.locator(this.TABPANEL);
    const text = await panel
      .getByTestId("body-file-name")
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
      const name = await this.keyValue.nameEditor(row).getValue();
      const fileButton = row.getByTestId("body-param-file");
      if ((await fileButton.count()) > 0) {
        const fileName =
          (await fileButton.getAttribute("title").catch(() => "")) ||
          undefined;
        if (name || fileName) params.push({ name, fileName });
        continue;
      }
      const value = await this.keyValue.valueEditor(row).getValue();
      const toggle = row.locator("button[aria-pressed]");
      const enabled =
        (await toggle.count()) === 0
          ? true
          : (await toggle.getAttribute("aria-pressed")) === "true";
      if (name || value) params.push({ name, value, disabled: !enabled });
    }
    return params;
  }

  private async setBodyParams(
    params: RequestBodyParameter[],
    stubFileChooser: (filePath: string) => Promise<void>,
  ): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    const deleteAllBtn = panel.getByRole("button", { name: "Delete all" });
    if (await deleteAllBtn.isEnabled()) {
      await deleteAllBtn.click();
    }

    const addBtn = panel.getByRole("button", { name: "Add", exact: true });
    const rows = panel.locator('[role="listbox"] [role="option"]');

    for (const [i, param] of params.entries()) {
      const countBefore = await rows.count();

      if (i > 0 || countBefore === 0) {
        await expect(async () => {
          const before = await rows.count();
          await addBtn.click();
          await expect(rows).toHaveCount(before + 1, { timeout: 1000 });
        }).toPass({ timeout: DEFAULT_TIMEOUT });
      }
      const row = rows.last();
      const setName = () =>
        this.keyValue.nameEditor(row).setValue(param.name);
      const setValue = () =>
        this.keyValue.valueEditor(row).setValue(param.value ?? "");
      await setName();
      await this.waitForPairPersisted(param, {
        checkValue: false,
        reapply: setName,
      });

      if (param.fileName) {
        await row.locator('button[aria-label="Text mode"]').click();
        const fileModeOption = this.page.locator(
          '[role="menuitemradio"][data-key="file"]',
        );
        await expect(fileModeOption).toBeVisible({ timeout: DEFAULT_TIMEOUT });
        await fileModeOption.click();
        await stubFileChooser(param.fileName);
        await new FileInputComponent(this.page, row).choose();
      } else {
        await setValue();
      }

      if (param.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }

      if (!param.fileName) {
        await this.waitForPairPersisted(param, {
          reapply: async () => {
            await setName();
            await setValue();
            await this.syncRowToggle(row, param);
          },
        });
      }
    }
    await this.waitForPairsSettled(params);
  }

  private async typeBody(text: string): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    const editor = panel.locator(".CodeMirror").first();
    await this.setCodeMirrorValue(editor, text);
  }
}
