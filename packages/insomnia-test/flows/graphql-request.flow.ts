import { BaseFlow } from "./base.flow";
import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import { Collection } from "../models/collection";
import { Folder } from "../models/folder";
import { GraphQLRequest } from "../models/graphql-request";
import { Response } from "../models/response";
import { GraphQLRequestPage } from "../pages/graphql-request.page";

export class GraphQLRequestFlow extends BaseFlow {
  /**
   * Creates a GraphQL request under `parent` via the standalone project
   * tree, then verifies it was created.
   * @param parent - The Collection or Folder under which the request is created
   * @param request - The request fields to apply after creation
   * @returns The created request, re-read from the UI
   */
  async create(
    parent: Collection | Folder,
    request: GraphQLRequest,
  ): Promise<GraphQLRequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.GraphQLRequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const graphqlRequestPage = this.pageManager.graphqlRequestPage;
    await graphqlRequestPage.navigate();
    await this.applyRequestFields(graphqlRequestPage, request);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Reads back an existing GraphQL request's fields via the standalone
   * project tree.
   * @param item - The request name, or an object identifying it by name/id
   * @param parent - The Collection the request belongs to, if any (unused — kept for call-site symmetry with other request flows)
   * @returns The request's fields, or undefined if it could not be found
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<GraphQLRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const graphqlRequestPage = this.pageManager.graphqlRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await graphqlRequestPage.navigate();

    const data = await graphqlRequestPage.get();
    return new GraphQLRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Sends `request` and reads back the resulting response via the
   * standalone project tree.
   * @param request - The request to send
   * @returns The response received after sending
   */
  async send(request: GraphQLRequest): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const graphqlRequestPage = this.pageManager.graphqlRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await graphqlRequestPage.navigate();

    await graphqlRequestPage.send();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: GraphQLRequestPage,
    request: GraphQLRequest,
  ): Promise<void> {
    await page.setMethod(request.method);
    await page.setUrl(request.url);
    if (request.params && request.params.length > 0) {
      await page.setParams(request.params);
    }
    if (request.headers && request.headers.length > 0) {
      await page.setHeaders(request.headers);
    }
    if (request.body) {
      await page.setBody(request.body);
      await page.prettify();
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }
}
