import { ContextMenuItem } from "../enums/context-menu-items";
import type { ResponseExportOption } from "../enums/response-export-option";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import type { Folder } from "../models/folder";
import type { RequestAuthentication, RequestParameter } from "../models/http-request";
import { HttpRequest } from "../models/http-request";
import type { ResponseView } from "../models/response";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { HttpRequestPage } from "../pages/http-request.page";
import { BaseFlow } from "./base.flow";

export class HttpRequestFlow extends BaseFlow {
  /**
   * Creates a new HTTP request under `parent`, naming it via the rename
   * flow and applying its fields on the request page.
   * @param parent - The Collection or Folder under which the request is created
   * @param request - The request definition to create, including its fields
   * @returns The created request, read back and asserted to exist
   */
  async create(parent: Collection | Folder, request: HttpRequest): Promise<HttpRequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.HttpRequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const httpRequestPage = this.pageManager.httpRequestPage;
    await httpRequestPage.navigate();
    await this.applyRequestFields(httpRequestPage, request, requestNode._id);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Replaces `request`'s query parameters using the Params tab's bulk
   * editor. Use after `create()` for requests with many params, where
   * per-row editing is prone to a stale-row-list save race.
   * @param request - The request to update (must exist in the sidebar)
   * @param params - The parameters to set
   */
  async setParamsBulk(request: HttpRequest, params: RequestParameter[]): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();
    await httpRequestPage.setParamsBulk(params);
  }

  /**
   * Reads back an existing request's fields by name or identity, looking
   * it up in the standalone project tree.
   * @param item - The request's name, or an object identifying it by name and optional id
   * @param parent - The Collection the request belongs to, if any (unused — kept for call-site symmetry with other request flows)
   * @returns The request populated with its current fields, or undefined if not found
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<HttpRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();

    const data = await httpRequestPage.get();
    return new HttpRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Sends `request` and returns the resulting response, locating it in the
   * standalone project tree.
   * @param request - The request to send
   * @returns The response view received after sending the request
   */
  async send(request: HttpRequest): Promise<ResponseView> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();

    await httpRequestPage.send();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  /**
   * Navigates to `request` and clicks its Auth tab's token-fetch button
   * (see `AuthTabComponent.fetchOAuth2Tokens()` — "Fetch Tokens" before
   * any token exists, "Refresh Token" once one does), then reads back
   * the resulting Refresh/Identity/Access Token fields in one call.
   * @param request - The request whose Auth tab already has OAuth 2.0 configured
   * @returns The tokens now stored on that request's Auth tab
   */
  async fetchOAuth2Tokens(request: HttpRequest): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();

    await httpRequestPage.auth.fetchOAuth2Tokens();
    return httpRequestPage.auth.getOAuth2Tokens();
  }

  /**
   * Exports the response currently shown for the last-sent request to
   * `filePath` via the response pane's "Preview" dropdown.
   * @param option - The export menu item to click
   * @param filePath - Absolute path the file should be written to
   */
  async exportResponse(option: ResponseExportOption, filePath: string): Promise<void> {
    await this.pageManager.responsePage.exportResponse(option, filePath);
  }

  /**
   * Saves the large response currently shown for the last-sent request to
   * `filePath` via the response pane's "Save To File" button.
   * @param filePath - Absolute path the file should be written to
   */
  async saveResponseToFile(filePath: string): Promise<void> {
    await this.pageManager.responsePage.saveResponseToFile(filePath);
  }

  /**
   * Reads an export menu item's label and disabled state for the response
   * currently shown.
   * @param option - The export menu item to inspect
   */
  async getResponseExportOptionState(
    option: ResponseExportOption,
  ): Promise<{ text: string; disabled: boolean }> {
    return this.pageManager.responsePage.getExportOptionState(option);
  }

  private async applyRequestFields(
    page: HttpRequestPage,
    request: HttpRequest,
    id: string,
  ): Promise<void> {
    await page.setMethod(request.method);
    await page.setUrl(request.url);
    await this.waitForUrlPersisted("insomnia.Request.db", page, id, request.url);
    if (request.params && request.params.length > 0) {
      await page.setParams(request.params);
    }
    if (request.headers && request.headers.length > 0) {
      await page.setHeaders(request.headers);
    }
    if (request.body) {
      await page.setBody(request.body);
    }
    if (request.authentication) {
      await this.applyHttpAuthentication(page, request.authentication);
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.scripts.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }

  /**
   * Applies `authentication` to the request pane's Auth tab. OAuth 1.0 is
   * HTTP-only so it is handled here; every other type is delegated to
   * `BaseFlow.applyAuthentication`.
   * @param page - The request page to apply authentication on
   * @param authentication - The authentication config to apply
   */
  private async applyHttpAuthentication(
    page: HttpRequestPage,
    authentication: RequestAuthentication,
  ): Promise<void> {
    if (authentication.type === "oauth1") {
      await page.auth.setOAuth1Fields(authentication);
      return;
    }
    await this.applyAuthentication(page.auth, authentication);
  }

}
