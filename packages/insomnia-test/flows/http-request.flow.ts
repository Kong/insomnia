import { ContextMenuItem } from "@package/enums/context-menu-items";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import type { Folder } from "@package/models/folder";
import type { RequestAuthentication } from "@package/models/http-request";
import { HttpRequest } from "@package/models/http-request";
import type { ResponseView } from "@package/models/response";
import type { HttpRequestPage } from "@package/pages/http-request.page";

import { BaseFlow } from "./base.flow";

export class HttpRequestFlow extends BaseFlow {
  /**
   * Creates a new HTTP request under `parent`, naming it via the rename
   * flow and applying its fields on the request page.
   */
  @step()
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
   * Reads back an existing request's fields by name or identity, looking
   * it up in the standalone project tree.
   */
  @step()
  async get(
    item: string | { name: string; id?: string },
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
   * Opens an existing request by name and reads back what its Auth tab
   * shows: the auth type label, plus the OAuth 2.0 fields when that type
   * is selected. Returns `undefined` if the request isn't in the tree.
   */
  @step()
  async getAuthentication(name: string): Promise<
    | {
        type: string;
        oauth2?: Awaited<ReturnType<HttpRequestPage["auth"]["getOAuth2Fields"]>>;
      }
    | undefined
  > {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;

    const node = await workspace.findItemNode({ name }, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();

    const type = await httpRequestPage.auth.getAuthType();
    return type === "OAuth 2.0"
      ? { type, oauth2: await httpRequestPage.auth.getOAuth2Fields() }
      : { type };
  }

  /**
   * Sends `request` and returns the resulting response, locating it in the
   * standalone project tree.
   */
  @step()
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
      await page.setBody(request.body, (filePath) => this.context.stubFileChooser(filePath));
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
