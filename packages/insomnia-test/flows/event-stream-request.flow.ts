import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import { EventStreamRequest } from "../models/event-stream-request";
import type { Folder } from "../models/folder";
import type { Response } from "../models/response";
import type { EventStreamRequestPage } from "../pages/event-stream-request.page";
import { BaseFlow } from "./base.flow";

export class EventStreamRequestFlow extends BaseFlow {
  /**
   * Creates an Event Stream request under `parent` via the standalone
   * project tree, then verifies it was created.
   * @param parent - The Collection or Folder under which the request is created
   * @param request - The request fields to apply after creation
   * @returns The created request, re-read from the UI
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
    await this.applyRequestFields(eventStreamRequestPage, request);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Reads back an existing Event Stream request's fields via the
   * standalone project tree.
   * @param item - The request name, or an object identifying it by name/id
   * @param parent - The Collection the request belongs to, if any (unused — kept for call-site symmetry with other request flows)
   * @returns The request's fields, or undefined if it could not be found
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

    await workspace.clickNode(node);
    await eventStreamRequestPage.waitForPane();

    const data = await eventStreamRequestPage.get();
    return new EventStreamRequest({
      name: identity.name,
      id: node._id,
      ...data,
    });
  }

  /**
   * Connects the event stream for `request` and reads back the resulting
   * response via the standalone project tree.
   * @param request - The request to connect
   * @returns The response captured after connecting
   */
  async send(request: EventStreamRequest): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const eventStreamRequestPage = this.pageManager.eventStreamRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await eventStreamRequestPage.navigate();

    await eventStreamRequestPage.connect();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: EventStreamRequestPage,
    request: EventStreamRequest,
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
    }
    if (request.preRequestScript || request.afterResponseScript) {
      await page.setScripts({
        preRequest: request.preRequestScript,
        afterResponse: request.afterResponseScript,
      });
    }
  }
}
