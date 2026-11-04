import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { GitCredential } from "@package/models/git-credential";
import type { CloudCredential } from "@package/models/settings";

import { PreferencesTabComponent } from "./preferences-tab.component";

type AwsCloudCredential = Extract<CloudCredential, { provider: "aws" }>;
type GcpCloudCredential = Extract<CloudCredential, { provider: "gcp" }>;
type HashiCorpCloudCredential = Extract<
  CloudCredential,
  { provider: "hashicorp" }
>;

/**
 * The Preferences dialog's Credentials tab: Git credentials and cloud
 * (vault provider) credentials.
 */
export class PreferencesCredentialsComponent extends PreferencesTabComponent {
  /**
   * Switches the open Preferences dialog to the Credentials tab, where Git
   * credentials are added/managed.
   */
  async openCredentialsTab(): Promise<void> {
    await this.tabs.tabByName("Credentials").click();
  }

  /**
   * Adds a custom (username/PAT) Git credential from the Credentials tab,
   * which must already be open (see `openCredentialsTab()`).
   */
  async addCustomCredential(credential: GitCredential): Promise<void> {
    const modal = this.page.getByRole("dialog", {
      name: /Access Token Credential/,
    });
    await this.dialog
      .getByRole("button", { name: "Create Git Credential" })
      .click();
    await this.page
      .getByRole("menuitem", { name: "Access Token", exact: true })
      .click();
    await this.page.getByLabel("Author Email").fill(credential.authorEmail);
    await this.page.getByLabel("Author Name").fill(credential.authorName);
    await this.page.getByLabel("Username").fill(credential.username);
    await this.page.getByLabel("Git Access Token").fill(credential.password);
    await this.page.getByRole("button", { name: "Save Credential" }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Adds an AWS cloud (vault) credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — selects the "Credential File" credential
   * type, matching the enterprise-plan-gated `@kong/insomnia-plugin-
   * external-vault` bundle plugin's own smoke-tested flow: under this
   * app's `PLAYWRIGHT=true` launch env, the plugin's `authenticate` action
   * short-circuits to a canned success without ever calling AWS STS, so
   * `credentials.section`/`.region` need only be well-formed strings, not
   * real AWS values.
   */
  async createAwsCloudCredential(
    credential: Omit<AwsCloudCredential, "provider">,
  ): Promise<void> {
    await new DropdownComponent(
      this.page,
      this.dialog.getByRole("button", { name: "Create Cloud Credential" }),
    ).select("AWS", false);
    const modal = new ModalComponent(
      this.page,
      this.page.getByRole("dialog", {
      name: /Authenticate With AWS/,
      }),
    );
    await modal.root
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal.root.getByRole("radio", { name: "Credential File" }).check();
    await modal.root
      .getByRole("textbox", { name: "Section Name:" })
      .fill(credential.credentials.section);
    await modal.root
      .getByRole("textbox", { name: "Region:" })
      .fill(credential.credentials.region);
    await modal.root.getByRole("button", { name: "Create", exact: true }).click();
    await modal.waitForHidden();
  }

  /**
   * Adds a GCP cloud (vault) credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — same `PLAYWRIGHT=true` bypass as
   * `createAwsCloudCredential()`, so `credentials.serviceAccountKeyFilePath`
   * need only be a non-empty string (the Create button stays disabled
   * while it's empty), not a real service account key file.
   */
  async createGcpCloudCredential(
    credential: Omit<GcpCloudCredential, "provider">,
  ): Promise<void> {
    await new DropdownComponent(
      this.page,
      this.dialog.getByRole("button", { name: "Create Cloud Credential" }),
    ).select("GCP", false);
    const modal = new ModalComponent(
      this.page,
      this.page.getByRole("dialog", {
      name: /Authenticate With GCP/,
      }),
    );
    await modal.root
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal.root
      .getByRole("textbox", { name: "Input Service Account Key Path" })
      .fill(credential.credentials.serviceAccountKeyFilePath);
    await modal.root.getByRole("button", { name: "Create", exact: true }).click();
    await modal.waitForHidden();
  }

  /**
   * Adds a HashiCorp Vault cloud credential from the Credentials tab's
   * "Service Provider Credential List", which must already be open (see
   * `openCredentialsTab()`) — leaves System Type/Auth Method on their
   * defaults (On-Premises/AppRole). Same `PLAYWRIGHT=true` bypass as
   * `createAwsCloudCredential()`, so `credentials.serverAddress` need only
   * be a well-formed URL (validated live, client-side) and
   * `credentials.role_id`/`.secret_id` need only be non-empty — the real
   * AppRole login call never happens.
   */
  async createHashiCorpCloudCredential(
    credential: Omit<HashiCorpCloudCredential, "provider">,
  ): Promise<void> {
    await new DropdownComponent(
      this.page,
      this.dialog.getByRole("button", { name: "Create Cloud Credential" }),
    ).select("HashiCorp", false);
    const modal = new ModalComponent(
      this.page,
      this.page.getByRole("dialog", {
      name: /Authenticate With HashiCorp/,
      }),
    );
    await modal.root
      .getByRole("textbox", { name: "Credential Name:" })
      .fill(credential.name);
    await modal.root
      .getByRole("textbox", { name: "Server Address:" })
      .fill(credential.credentials.serverAddress);
    await modal.root
      .getByRole("textbox", { name: "Role Id:" })
      .fill(credential.credentials.role_id);
    await modal.root
      .getByRole("textbox", { name: "Secret Id:" })
      .fill(credential.credentials.secret_id);
    await modal.root.getByRole("button", { name: "Create", exact: true }).click();
    await modal.waitForHidden();
  }
}
