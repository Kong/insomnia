import { step } from "@package/misc/step";
import type { ClientCertificate } from "@package/models/client-certificate";
import type { Collection } from "@package/models/collection";
import type { HttpRequest } from "@package/models/http-request";

import { BaseFlow } from "./base.flow";

export type CertificateTarget = Collection | HttpRequest;

export class CertificatesFlow extends BaseFlow {
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
   * Toggles a client certificate's Enabled/Disabled state, identified by its
   * `host`, opening the "Manage Certificates" dialog from `item`'s location.
   */
  @step()
  async setClientCertificateEnabled(item: CertificateTarget, host: string, enabled: boolean): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.setClientCertificateEnabled(host, enabled);
    await certificatesPage.close();
  }

  /**
   * Toggles `item`'s workspace-wide CA Certificate's Enabled/Disabled state,
   * opening the "Manage Certificates" dialog from `item`'s location.
   */
  @step()
  async setCaCertificateEnabled(item: CertificateTarget, enabled: boolean): Promise<void> {
    await this.openTarget(item);

    const { certificatesPage } = this.pageManager;
    await certificatesPage.open();
    await certificatesPage.setCaCertificateEnabled(enabled);
    await certificatesPage.close();
  }

  private async openTarget(item: CertificateTarget): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
  }
}
