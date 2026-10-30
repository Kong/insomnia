import type { RequestAuthentication } from "insomnia-data";

import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import { EventStreamRequest } from "../models/event-stream-request";
import type { Folder } from "../models/folder";
import type { ResponseView } from "../models/response";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { EventStreamRequestPage } from "../pages/event-stream-request.page";
import { BaseFlow } from "./base.flow";

export class EventStreamRequestFlow extends BaseFlow {
  /**
   * Creates an Event Stream request under `parent` via the standalone
   * project tree, then verifies it was created.
   */
  async create(
    parent: Collection | Folder,
    request: EventStreamRequest,
  ): Promise<EventStreamRequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.EventStreamRequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const eventStreamRequestPage = this.pageManager.eventStreamRequestPage;
    await eventStreamRequestPage.navigate();
    await this.applyRequestFields(
      eventStreamRequestPage,
      request,
      requestNode._id,
    );

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Reads back an existing Event Stream request's fields via the
   * standalone project tree.
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<EventStreamRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const eventStreamRequestPage = this.pageManager.eventStreamRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.openRequestNode(node);
    await eventStreamRequestPage.waitForPane();

    const data = await eventStreamRequestPage.get();
    return new EventStreamRequest({
      name: identity.name,
      id: node._id,
      ...data,
    });
  }

  /**
   * Opens `request`, clicks its Auth tab's token-fetch button and reads
   * the resulting tokens back.
   */
  async fetchOAuth2Tokens(request: EventStreamRequest): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const page = this.pageManager.eventStreamRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await page.navigate();

    await page.auth.fetchOAuth2Tokens();
    return page.auth.getOAuth2Tokens();
  }

  /**
   * Opens `request` and applies `authentication` on its Auth tab.
   */
  async setAuthentication(
    request: EventStreamRequest,
    authentication: RequestAuthentication,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const page = this.pageManager.eventStreamRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await page.navigate();
    await this.applyAuthentication(page.auth, authentication);
  }

  /**
   * Connects the event stream for `request` and reads back the resulting
   * response via the standalone project tree.
   */
  async send(
    request: EventStreamRequest,
    options?: { expectConnected?: boolean },
  ): Promise<ResponseView> {
    const workspace = this.pageManager.workspacePage;
    const eventStreamRequestPage = this.pageManager.eventStreamRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await eventStreamRequestPage.navigate();

    await eventStreamRequestPage.connect(options);
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: EventStreamRequestPage,
    request: EventStreamRequest,
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
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.scripts.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }
}
