import { step } from "../misc/step";
import type { ClientCertificate } from "../models/client-certificate";
import type { Collection } from "../models/collection";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import type { McpClient } from "../models/mcp-client";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import { BaseFlow } from "./base.flow";

export type CertificateTarget =
  | Collection
  | HttpRequest
  | EventStreamRequest
  | GraphQLRequest
  | GrpcRequest
  | McpClient
  | SocketIORequest
  | WebSocketRequest;

export class CertificatesFlow extends BaseFlow {
  /**
   * Sets `item`'s workspace-wide CA Certificate, opening the "Manage
   * Certificates" dialog from `item`'s location. Overwrites any CA
   * certificate already set.
   */
  @step()
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
   */
  @step()
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
   */
  @step()
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

  /**
   * Toggles `item`'s workspace-wide CA Certificate's Enabled/Disabled
   * state, opening the "Manage Certificates" dialog from `item`'s location.
   */
  @step()
  async setCaCertificateEnabled(
    item: CertificateTarget,
    enabled: boolean,
  ): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.setCaCertificateEnabled(enabled);
    await certificatesPage.close();
  }

  /**
   * Toggles an MCP Client's "SSL Certificate Validation" switch, opening
   * the "Manage Certificates" dialog from the client's location.
   */
  @step()
  async setSslValidationEnabled(
    client: McpClient,
    enabled: boolean,
  ): Promise<void> {
    await this.openTarget(client);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.setSslValidationEnabled(enabled);
    await certificatesPage.close();
  }
}
