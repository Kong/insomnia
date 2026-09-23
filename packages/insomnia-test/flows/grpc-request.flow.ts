import { BaseFlow } from "./base.flow";
import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import { Collection } from "../models/collection";
import { Folder } from "../models/folder";
import { GrpcRequest } from "../models/grpc-request";
import { GrpcRequestPage } from "../pages/grpc-request.page";

export interface GrpcResponse {
  status?: { code: string; message: string };
  message?: unknown;
  messages?: unknown[];
}

export class GrpcRequestFlow extends BaseFlow {
  /**
   * Creates a gRPC request under `parent` via the standalone project tree,
   * then verifies it was created.
   * @param parent - The Collection or Folder under which the request is created
   * @param request - The request fields to apply after creation
   * @returns The created request, re-read from the UI
   */
  async create(parent: Collection | Folder, request: GrpcRequest): Promise<GrpcRequest> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.GrpcRequest);

    const requestNode = await workspace.waitForFirstRealChild(node._id);
    await workspace.rightClick(requestNode);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(request.name);
    await workspace.clickRename();

    const grpcRequestPage = this.pageManager.grpcRequestPage;
    await grpcRequestPage.navigate();
    await this.applyRequestFields(grpcRequestPage, request, requestNode._id);

    return this.assertCreated(await this.get(request.name), request.name);
  }

  /**
   * Reads back an existing gRPC request's fields via the standalone
   * project tree.
   * @param item - The request name, or an object identifying it by name/id
   * @param parent - The Collection the request belongs to, if any (unused — kept for call-site symmetry with other request flows)
   * @returns The request's fields, or undefined if it could not be found
   */
  async get(
    item: string | { name: string; id?: string },
    parent?: Collection,
  ): Promise<GrpcRequest | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const grpcRequestPage = this.pageManager.grpcRequestPage;

    const node = await workspace.findItemNode(identity, TreeNodeType.Request);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await grpcRequestPage.navigate();

    const data = await grpcRequestPage.get();
    return new GrpcRequest({ name: identity.name, id: node._id, ...data });
  }

  /**
   * Cancels `request`'s in-flight call — a still-in-flight unary/
   * server-streaming call, or an open client/bidi-streaming call — then
   * reads back the resulting gRPC status.
   * @param request - The request whose call should be cancelled
   * @returns The gRPC status received after cancelling
   */
  async cancel(request: GrpcRequest): Promise<GrpcResponse> {
    const grpcRequestPage = await this.openRequest(request);
    await grpcRequestPage.cancel();
    return this.readResponse();
  }

  /**
   * Closes the client half of `request`'s open client-streaming or
   * bidi-streaming call by clicking "Commit", then reads back the
   * resulting gRPC status and message(s).
   * @param request - The request whose open call should be committed
   * @returns The gRPC status and message(s) received after committing
   */
  async commit(request: GrpcRequest): Promise<GrpcResponse> {
    const grpcRequestPage = await this.openRequest(request);
    await grpcRequestPage.commit();
    return this.readResponse();
  }

  /**
   * Sends `request` and reads back the resulting gRPC status and
   * message(s) via the standalone project tree. For unary and
   * server-streaming methods this waits for the whole call to complete;
   * for client/bidi-streaming methods, use `start()` instead since no
   * response arrives until `commit()` closes the client's half of the
   * stream.
   * @param request - The request to send
   * @returns The gRPC status and message(s) received after sending
   */
  async send(request: GrpcRequest): Promise<GrpcResponse> {
    const grpcRequestPage = await this.openRequest(request);
    await grpcRequestPage.send();
    return this.readResponse();
  }

  /**
   * Opens a client-streaming or bidi-streaming call by clicking "Start".
   * Unlike `send()`, this does not wait for a response — none arrives
   * until `commit()` closes the client's half of the stream.
   * @param request - The request to start streaming
   */
  async start(request: GrpcRequest): Promise<void> {
    const grpcRequestPage = await this.openRequest(request);
    await grpcRequestPage.send();
  }

  /**
   * Sends one message over `request`'s open client-streaming or
   * bidi-streaming call. Can be called repeatedly with different bodies
   * before calling `commit()`.
   * @param request - The request whose open call the message is sent over — must carry `id` (set by `create()`/`get()`) so the just-set body can be confirmed persisted before streaming it
   * @param body - The message body to stream
   */
  async streamMessage(request: GrpcRequest, body: string): Promise<void> {
    if (!request.id) {
      throw new Error(
        "streamMessage(): request.id is required to confirm the body persisted before streaming it",
      );
    }
    const grpcRequestPage = await this.openRequest(request);
    await grpcRequestPage.setBody(body);
    await this.waitForBodyPersisted(request.id, body);
    await grpcRequestPage.clickStream();
  }

  private async applyRequestFields(
    page: GrpcRequestPage,
    request: GrpcRequest,
    id: string,
  ): Promise<void> {
    await page.setUrl(request.url);
    await this.waitForUrlPersisted(id, request.url);
    if (request.method) {
      await page.fetchServerReflection();
      await page.setMethod(request.method);
    }
    if (request.body) {
      await page.setBody(request.body);
      await this.waitForBodyPersisted(id, request.body);
    }
    if (request.headers && request.headers.length > 0) {
      await page.setHeaders(request.headers);
    }
  }

  /**
   * Waits until `id`'s persisted `body.text` settles on `content`. The app
   * patches a just-set body into the request's state in the background
   * rather than synchronously, and a UI read-back right after `setBody()`
   * can observe an optimistic value that a later remount then reverts —
   * reading the same on-disk store the real gRPC call reads from is the
   * only way to know the value that will actually be sent has landed.
   * Observed live: proceeding before this settled silently wiped the name
   * just typed into a freshly-added header row (its value, typed slightly
   * later, survived the remount), and separately let a streamed message go
   * out with the previous body instead of the one just set.
   * @param id - The `_id` of the gRPC request whose body was just set
   * @param content - The body text that must be the persisted value
   */
  private async waitForBodyPersisted(id: string, content: string): Promise<void> {
    await this.waitForFieldPersisted(
      "insomnia.GrpcRequest.db",
      id,
      (doc) => doc?.body?.text,
      content,
    );
  }

  /**
   * Waits until `id`'s persisted `url` settles on `url`, for the same
   * reason `setUrl()`'s caller-facing docs already warn about:
   * `setCodeMirrorValue()` only confirms the live CodeMirror instance
   * reflects the new address, not that the debounced save actually
   * landed, so a request created (or sent) right after `setUrl()` can
   * otherwise still carry the previous server address.
   * @param id - The `_id` of the gRPC request whose URL was just set
   * @param url - The server address that must be the persisted value
   */
  private async waitForUrlPersisted(id: string, url: string): Promise<void> {
    await this.waitForFieldPersisted(
      "insomnia.GrpcRequest.db",
      id,
      (doc) => doc?.url,
      url,
    );
  }

  /**
   * Locates and opens `request`'s request pane via the standalone project
   * tree.
   * @param request - The request to open
   * @returns The opened gRPC request page
   */
  private async openRequest(request: GrpcRequest): Promise<GrpcRequestPage> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.findItemNode(request, TreeNodeType.Request);
    await workspace.clickNode(node!);

    const grpcRequestPage = this.pageManager.grpcRequestPage;
    await grpcRequestPage.navigate();
    return grpcRequestPage;
  }

  /**
   * Reads back the gRPC status and message(s) currently shown in the
   * response pane.
   * @returns The gRPC status and message(s)
   */
  private async readResponse(): Promise<GrpcResponse> {
    const responsePage = this.pageManager.responsePage;
    await responsePage.navigateGrpc();
    const messages = await responsePage.getGrpcMessages();
    return {
      status: await responsePage.getGrpcStatus(),
      message: messages[0],
      messages,
    };
  }
}
