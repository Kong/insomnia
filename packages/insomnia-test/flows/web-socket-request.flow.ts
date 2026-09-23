import { BaseFlow } from "./base.flow";
import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import { Collection } from "../models/collection";
import { Folder } from "../models/folder";
import {
  WebSocketRequest,
  WebSocketRequestBody,
} from "../models/websocket-request";
import { Response } from "../models/response";
import { WebSocketRequestPage } from "../pages/web-socket-request.page";

export class WebSocketRequestFlow extends BaseFlow {
  /**
   * Creates a new WebSocket request under `parent`, naming it via the
   * rename flow and applying its fields on the request page.
   * @param parent - The Collection or Folder under which the request is created
   * @param request - The request definition to create, including its fields
   * @returns The created request, read back and asserted to exist
   */
  async create(
    parent: Collection | Folder,
    request: WebSocketRequest,
  ): Promise<WebSocketRequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.WebSocketRequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const webSocketRequestPage = this.pageManager.webSocketRequestPage;
    await webSocketRequestPage.navigate();
    await this.applyRequestFields(webSocketRequestPage, request);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Closes the WebSocket connection for `request`, invoking `callback`
   * once the disconnect completes (or after `timeout` ms elapses), and
   * returns the resulting response, locating it via the standalone
   * project tree.
   * @param request - The request whose connection should be closed
   * @param callback - Invoked once the disconnect completes; defaults to a no-op
   * @param timeout - Maximum time in milliseconds to wait for the disconnect; defaults to 5000
   * @returns The response received after disconnecting
   */
  async disconnect(
    request: WebSocketRequest,
    callback: () => Promise<void> | void = () => {},
    timeout: number = 5000,
  ): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const webSocketRequestPage = this.pageManager.webSocketRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await webSocketRequestPage.navigate();

    await webSocketRequestPage.disconnect(callback, timeout);
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  /**
   * Reads back an existing request's fields by name or identity via the
   * standalone project tree.
   * @param item - The request's name, or an object identifying it by name and optional id
   * @param parent - The Collection the request belongs to, if any (unused — kept for call-site symmetry with other request flows)
   * @returns The request populated with its current fields, or undefined if not found
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<WebSocketRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const webSocketRequestPage = this.pageManager.webSocketRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await webSocketRequestPage.navigate();

    const data = await webSocketRequestPage.get();
    return new WebSocketRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Opens the WebSocket connection for `request` and returns the
   * resulting response, locating it via the standalone project tree.
   * @param request - The request whose connection should be opened
   * @returns The response received after connecting
   */
  async send(request: WebSocketRequest): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const webSocketRequestPage = this.pageManager.webSocketRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await webSocketRequestPage.navigate();

    await webSocketRequestPage.connect();
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  /**
   * Sends `body` as a message over the request's open WebSocket
   * connection, invoking `callback` once the send completes (or after
   * `timeout` ms elapses), and returns the resulting response, locating it
   * via the standalone project tree.
   * @param request - The request whose connection the message is sent over
   * @param body - The message body to send
   * @param callback - Invoked once the send completes; defaults to a no-op
   * @param timeout - Maximum time in milliseconds to wait for the send; defaults to 5000
   * @returns The response received after sending the message
   */
  async sendMessage(
    request: WebSocketRequest,
    body: WebSocketRequestBody,
    callback: () => Promise<void> | void = () => {},
    timeout: number = 5000,
  ): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const webSocketRequestPage = this.pageManager.webSocketRequestPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);
    await webSocketRequestPage.navigate();

    await webSocketRequestPage.sendMessage(body, callback, timeout);
    await responsePage.navigate();

    const data = await responsePage.get();
    return data;
  }

  private async applyRequestFields(
    page: WebSocketRequestPage,
    request: WebSocketRequest,
  ): Promise<void> {
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
  }
}
