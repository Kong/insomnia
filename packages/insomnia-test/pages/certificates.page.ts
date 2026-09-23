import { expect, Locator } from "@playwright/test";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { ClientCertificate } from "../models/certificate";
import { BasePage } from "./base.page";

export class CertificatesPage extends BasePage {
  /**
   * Confirmed live: the "Manage Certificates" overlay is actually two
   * nested `role="dialog"` elements — an inner, named section holding
   * only the header/CA-cert-picker/buttons, and an outer, unnamed one
   * that also contains the (virtualized, non-descendant-queryable)
   * certificate grid. `.filter({ hasText })` + `.first()` latches onto
   * that outer element, matching how every row lookup below needs to see
   * the grid's rendered content.
   */
  private readonly dialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Manage Certificates" })
    .first();

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
    await this.dialog.getByRole("button", { name: "Done" }).click();
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Uploads a PEM file as the workspace's single CA Certificate via its
   * hidden native file input (not an Electron `dialog.showOpenDialog` —
   * confirmed live this control is a plain `<input type="file">`, so no
   * `stubFileChooser()` is needed here). Overwrites any CA certificate
   * already set.
   * @param path - Absolute path to a PEM-format CA certificate file
   */
  async addCaCertificate(path: string): Promise<void> {
    await this.dialog
      .locator('input[type="file"][accept=".pem"]')
      .setInputFiles(path);
    await expect(this.caCertificateRow()).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Adds a client certificate via "Add client certificate" -> the
   * "Add Client Certificate" form's default "Certificate" tab (PEM cert +
   * key files, not the "PFX or PKCS12" tab — unconfirmed live, not covered
   * here). Both file fields are plain native `<input type="file">`
   * elements, set directly via `setInputFiles()` with no dialog stubbing.
   * @param certificate - The client certificate to add
   */
  async addClientCertificate(certificate: ClientCertificate): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Add client certificate" })
      .click();
    const form = this.page.getByRole("dialog", {
      name: "Add Client Certificate",
    });
    await expect(form).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await form.locator('input[name="host"]').fill(certificate.host);
    const fileInputs = form.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(certificate.cert);
    await fileInputs.nth(1).setInputFiles(certificate.key);
    if (certificate.passphrase !== undefined) {
      await form.locator('input[name="passphrase"]').fill(certificate.passphrase);
    }
    await form.getByRole("button", { name: "Add certificate", exact: true }).click();
    await expect(form).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(this.clientCertificateRow(certificate.host)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Toggles a client certificate's Enabled/Disabled state, identified by
   * its `host`. A no-op if it already matches `enabled`.
   * @param host - The client certificate's configured host
   * @param enabled - Whether the client certificate should be enabled
   */
  async setClientCertificateEnabled(
    host: string,
    enabled: boolean,
  ): Promise<void> {
    await this.setRowEnabled(this.clientCertificateRow(host), enabled);
  }

  private async setRowEnabled(row: Locator, enabled: boolean): Promise<void> {
    const toggle = row.getByRole("button", { name: /^(Enabled|Disabled)$/ });
    const current = (await toggle.innerText()) === "Enabled";
    if (current !== enabled) {
      await toggle.click();
      await expect(toggle).toHaveText(enabled ? "Enabled" : "Disabled", {
        timeout: DEFAULT_TIMEOUT,
      });
    }
  }

  /**
   * The CA Certificate's own row. Confirmed live: unlike the (host-keyed,
   * possibly-multiple) Client Certificates list below it, the single CA
   * Certificate is NOT a `role="row"` grid item — it's a plain `<div>`
   * sibling immediately following the section's own description
   * paragraph, so it's located structurally rather than by role.
   */
  private caCertificateRow(): Locator {
    return this.dialog.locator(
      'p:has-text("PEM format certificates") + div',
    );
  }

  /**
   * A client certificate's row, identified by its configured `host` text.
   * `role="row"` scoping alone is enough to exclude the CA Certificate's
   * own (plain, non-`role="row"`) container above — host values are
   * unique per test, so no further disambiguation is needed.
   */
  private clientCertificateRow(host: string): Locator {
    return this.dialog.locator('[role="row"]').filter({ hasText: host });
  }
}
