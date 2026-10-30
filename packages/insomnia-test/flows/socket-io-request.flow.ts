import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import type { Collection } from "../models/collection";
import type { Folder } from "../models/folder";
import type { ResponseView } from "../models/response";
import { SocketIORequest } from "../models/socket-io-request";
import type { SocketIORequestPage } from "../pages/socket-io-request.page";
import { BaseFlow } from "./base.flow";

export class SocketIORequestFlow extends BaseFlow {
  /**
   * Opens the Socket.IO connection for `request`, locating it via the
   * standalone project tree before connecting.
   */
  async connect(request: SocketIORequest): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const socketIoRequestPage = this.pageManager.socketIoRequestPage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await socketIoRequestPage.navigate();
    await socketIoRequestPage.connect();
  }

  /**
   * Creates a new Socket.IO request under `parent`, naming it via the
   * rename flow and applying its fields on the request page.
   */
  async create(
    parent: Collection | Folder,
    request: SocketIORequest,
  ): Promise<SocketIORequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.SocketIORequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const socketIoRequestPage = this.pageManager.socketIoRequestPage;
    await socketIoRequestPage.navigate();
    await this.applyRequestFields(socketIoRequestPage, request, requestNode._id);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Closes the Socket.IO connection for `request`, invoking `callback`
   * once the disconnect completes (or after `timeout` ms elapses), and
   * returns the resulting response, locating it via the standalone project
   * tree.
   */
  async disconnect(
    request: SocketIORequest,
    callback: () => Promise<void> | void = () => {},
    timeout = DEFAULT_TIMEOUT,
  ): Promise<ResponseView> {
    const workspace = this.pageManager.workspacePage;
    const socketIoRequestPage = this.pageManager.socketIoRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await socketIoRequestPage.navigate();

    await socketIoRequestPage.disconnect(callback, timeout);
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  /**
   * Reads back an existing request's fields by name or identity via the
   * standalone project tree.
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<SocketIORequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const socketIoRequestPage = this.pageManager.socketIoRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.openRequestNode(node);
    await socketIoRequestPage.navigate();

    const data = await socketIoRequestPage.get();
    return new SocketIORequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Sends the request's configured message over an already-open Socket.IO
   * connection and returns the resulting response, locating it via the
   * standalone project tree.
   */
  async sendMessage(request: SocketIORequest): Promise<ResponseView> {
    const workspace = this.pageManager.workspacePage;
    const socketIoRequestPage = this.pageManager.socketIoRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await socketIoRequestPage.navigate();

    await socketIoRequestPage.sendMessage();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: SocketIORequestPage,
    request: SocketIORequest,
    id: string,
  ): Promise<void> {
    await page.setUrl(request.url);
    await this.waitForUrlPersisted("insomnia.SocketIORequest.db", page, id, request.url);
    if (request.headers && request.headers.length > 0) {
      await page.setHeaders(request.headers);
    }
    if (request.authentication) {
      await this.applyAuthentication(page.auth, request.authentication);
    }
    if (request.message) {
      await page.setMessage(request.message);
    }
  }
}
