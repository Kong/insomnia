import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { ClientCertificate } from "@package/models/client-certificate";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class CertificatesPage extends BasePage {
  /**
   * The "Manage Certificates" overlay is actually two
   * nested `role="dialog"` elements — an inner, named section holding
   * only the header/CA-cert-picker/buttons, and an outer, unnamed one
   * that also contains the (virtualized, non-descendant-queryable)
   * certificate grid. `.filter({ hasText })` + `.first()` latches onto
   * that outer element, matching how every row lookup below needs to see
   * the grid's rendered content.
   */
  private get modal(): ModalComponent {
    return new ModalComponent(
      this.page,
      this.page
        .getByRole("dialog")
        .filter({ hasText: "Manage Certificates" })
        .first(),
    );
  }
  private get dialog(): Locator {
    return this.modal.root;
  }

  /**
   * Waits for the "Manage Certificates" dialog to become visible,
   * confirming it's ready for interaction.
   */
  async navigate(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the "Manage Certificates" dialog via the Collection toolbar's
   * "Certificates"/"Certificates (N)" button.
   */
  async open(): Promise<void> {
    await this.page.getByRole("button", { name: "Certificates" }).click();
    await this.navigate();
  }

  /**
   * Closes the "Manage Certificates" dialog via its "Done" button.
   */
  async close(): Promise<void> {
    await this.modal.clickButton("Done", false);
    await this.modal.waitForHidden();
  }

  /**
   * Adds a client certificate via "Add client certificate" -> the
   * "Add Client Certificate" form's default "Certificate" tab (PEM cert +
   * key files, not the "PFX or PKCS12" tab — not covered
   * here). Both file fields are plain native `<input type="file">`
   * elements, set directly via `setInputFiles()` with no dialog stubbing.
   */
  async addClientCertificate(certificate: ClientCertificate): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Add client certificate" })
      .click();
    const formModal = new ModalComponent(
      this.page,
      this.page.getByRole("dialog", { name: "Add Client Certificate" }),
    );
    const form = formModal.root;
    await formModal.expectOpen();

    await form.locator('input[name="host"]').fill(certificate.host);
    const fileInputs = form.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(certificate.cert);
    await fileInputs.nth(1).setInputFiles(certificate.key);
    if (certificate.passphrase !== undefined) {
      await form.locator('input[name="passphrase"]').fill(certificate.passphrase);
    }
    await formModal.confirm("Add certificate");
    await expect(this.clientCertificateRow(certificate.host)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * A client certificate's row, identified by its configured `host` text.
   * `role="row"` scoping alone is enough to exclude the CA Certificate's
   * own (plain, non-`role="row"`) container — host values are unique per
   * test, so no further disambiguation is needed.
   */
  private clientCertificateRow(host: string): Locator {
    return new TableComponent(this.page, this.dialog).rowByText(host);
  }
}
