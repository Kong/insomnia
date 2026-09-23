import type { ClientCertificate } from "../models/certificate";
import type { Collection } from "../models/collection";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import { BaseFlow } from "./base.flow";

export type CertificateTarget =
  | Collection
  | HttpRequest
  | EventStreamRequest
  | GraphQLRequest
  | GrpcRequest
  | SocketIORequest
  | WebSocketRequest;

export class CertificatesFlow extends BaseFlow {
  /**
   * Sets `item`'s workspace-wide CA Certificate, opening the "Manage
   * Certificates" dialog from `item`'s location. Overwrites any CA
   * certificate already set.
   * @param item - The Collection/request whose location the dialog is opened from
   * @param path - Absolute path to a PEM-format CA certificate file
   */
  async setCaCertificate(item: CertificateTarget, path: string): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.addCaCertificate(path);
    await certificatesPage.close();
  }

  /**
   * Adds a client certificate to `item`'s workspace, opening the "Manage
   * Certificates" dialog from `item`'s location.
   * @param item - The Collection/request whose location the dialog is opened from
   * @param certificate - The client certificate to add
   */
  async addClientCertificate(
    item: CertificateTarget,
    certificate: ClientCertificate,
  ): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.addClientCertificate(certificate);
    await certificatesPage.close();
  }

  /**
   * Toggles a client certificate's Enabled/Disabled state, identified by
   * its `host`, opening the "Manage Certificates" dialog from `item`'s
   * location.
   * @param item - The Collection/request whose location the dialog is opened from
   * @param host - The client certificate's configured host
   * @param enabled - Whether the client certificate should be enabled
   */
  async setClientCertificateEnabled(
    item: CertificateTarget,
    host: string,
    enabled: boolean,
  ): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.setClientCertificateEnabled(host, enabled);
    await certificatesPage.close();
  }

  private async openTarget(item: CertificateTarget): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
  }
}
