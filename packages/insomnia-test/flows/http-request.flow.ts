import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import type { Folder } from "../models/folder";
import type { RequestAuthentication } from "../models/http-request";
import { HttpRequest } from "../models/http-request";
import type { Response } from "../models/response";
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

    await workspace.clickNode(node);
    await httpRequestPage.navigate();

    const data = await httpRequestPage.get();
    return new HttpRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Sends `request` and returns the resulting response, locating it in the
   * standalone project tree.
   * @param request - The request to send
   * @returns The response received after sending the request
   */
  async send(request: HttpRequest): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await httpRequestPage.navigate();

    await httpRequestPage.send();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  /**
   * Navigates to `request` and clicks its Auth tab's token-fetch button
   * (see `HttpRequestPage.fetchOAuth2Tokens()` — "Fetch Tokens" before
   * any token exists, "Refresh Token" once one does), then reads back
   * the resulting Refresh/Identity/Access Token fields in one call.
   * @param request - The request whose Auth tab already has OAuth 2.0 configured
   * @returns The tokens now stored on that request's Auth tab
   */
  async fetchOAuth2Tokens(request: HttpRequest): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await httpRequestPage.navigate();

    await httpRequestPage.fetchOAuth2Tokens();
    return httpRequestPage.getOAuth2Tokens();
  }

  private async applyRequestFields(
    page: HttpRequestPage,
    request: HttpRequest,
    id: string,
  ): Promise<void> {
    await page.setMethod(request.method);
    await page.setUrl(request.url);
    await this.waitForUrlPersisted(page, id, request.url);
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
      await this.applyAuthentication(page, request.authentication);
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }

  /**
   * Confirms `id`'s URL actually persisted as `url`, re-issuing
   * `page.setUrl()` if not. Confirmed live: on a request whose backing
   * document is still mid-creation, `HttpRequestPage.setUrl()`'s direct
   * `CodeMirror.setValue()` can be silently reverted by the app's own
   * background patch of that still-initializing document — reliably
   * reproducible for a URL containing a `{% %}` tag, since the tag's inline
   * widget decoration re-renders the editor around the same time. Passively
   * waiting for that in-flight patch to settle (the fix already used by
   * `GrpcRequestFlow`'s URL/body waits) doesn't help here: the value never
   * lands on its own, only once the write is repeated after the initial
   * patch has already landed. Typing the same text via real keystrokes
   * instead never hits this — only the direct `setValue()` bypass does —
   * so this re-sends the same write `page.setUrl()` already made, once the
   * on-disk store the app itself reads from shows it was lost.
   * @param page - The request page `url` was just set on
   * @param id - The `_id` of the HTTP request whose URL was just set
   * @param url - The URL that must be the persisted value
   */
  private async waitForUrlPersisted(
    page: HttpRequestPage,
    id: string,
    url: string,
  ): Promise<void> {
    await this.waitForFieldPersisted(
      "insomnia.Request.db",
      id,
      (doc) => doc?.url,
      url,
      () => page.setUrl(url),
    );
  }

  /**
   * Applies `authentication` to the request pane's Auth tab. Only OAuth
   * 1.0 and OAuth 2.0 are wired up so far — other auth types will need
   * their own Page setter before they can be added here.
   * @param page - The request page to apply authentication on
   * @param authentication - The authentication config to apply
   */
  private async applyAuthentication(
    page: HttpRequestPage,
    authentication: RequestAuthentication,
  ): Promise<void> {
    if (authentication.type === "oauth1") {
      await page.setOAuth1Fields(authentication);
    }
    if (authentication.type === "oauth2") {
      await page.setOAuth2Fields(authentication);
    }
  }

}
