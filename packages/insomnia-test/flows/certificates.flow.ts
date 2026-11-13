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

  private async openTarget(item: CertificateTarget): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
  }
}
