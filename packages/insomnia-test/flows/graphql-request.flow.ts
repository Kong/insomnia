import type { RequestAuthentication } from "insomnia-data";

import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import { step } from "../misc/step";
import type { Collection } from "../models/collection";
import type { Folder } from "../models/folder";
import { GraphQLRequest } from "../models/graphql-request";
import type { ResponseView } from "../models/response";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { GraphQLRequestPage } from "../pages/graphql-request.page";
import { BaseFlow } from "./base.flow";

export class GraphQLRequestFlow extends BaseFlow {
  /**
   * Creates a GraphQL request under `parent` via the standalone project
   * tree, then verifies it was created.
   */
  @step()
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
    await this.applyRequestFields(graphqlRequestPage, request, requestNode._id);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Reads back an existing GraphQL request's fields via the standalone
   * project tree.
   */
  @step()
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<GraphQLRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const graphqlRequestPage = this.pageManager.graphqlRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.openRequestNode(node);
    await graphqlRequestPage.navigate();

    const data = await graphqlRequestPage.get();
    return new GraphQLRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Opens `request`, clicks its Auth tab's token-fetch button and reads
   * the resulting tokens back.
   */
  @step()
  async fetchOAuth2Tokens(request: GraphQLRequest): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const page = this.pageManager.graphqlRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await page.navigate();

    await page.auth.fetchOAuth2Tokens();
    return page.auth.getOAuth2Tokens();
  }

  /**
   * Opens `request` and applies `authentication` on its Auth tab.
   */
  @step()
  async setAuthentication(
    request: GraphQLRequest,
    authentication: RequestAuthentication,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const page = this.pageManager.graphqlRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await page.navigate();
    await this.applyAuthentication(page.auth, authentication);
  }

  /**
   * Sends `request` and reads back the resulting response via the
   * standalone project tree.
   */
  @step()
  async send(request: GraphQLRequest): Promise<ResponseView> {
    const workspace = this.pageManager.workspacePage;
    const graphqlRequestPage = this.pageManager.graphqlRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await graphqlRequestPage.navigate();

    await graphqlRequestPage.send();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: GraphQLRequestPage,
    request: GraphQLRequest,
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
    if (request.authentication) {
      await this.applyAuthentication(page.auth, request.authentication);
    }
    if (request.body) {
      await page.setBody(request.body);
      await page.prettify();
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.scripts.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }
}
