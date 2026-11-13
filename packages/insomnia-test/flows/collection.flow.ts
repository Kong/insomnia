import type { OAuth2Tokens } from "@package/components/auth-tab.component";
import type { KeyValueRow } from "@package/components/key-value-editor.component";
import type { RequestScripts } from "@package/components/script-tab.component";
import type { WorkspaceEnvironmentsComponent } from "@package/components/workspace-environments.component";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import type { CollectionPage } from "@package/pages/collection.page";
import { expect } from "@playwright/test";
import type { AuthTypeAPIKey, AuthTypeBasic, AuthTypeBearer, AuthTypeOAuth2 } from "insomnia-data";

import { BaseFlow } from "./base.flow";

/**
 * Drives the collection-level properties — Auth, Headers, Scripts,
 * Environment and Docs — through the collection's own tab bar. Every method
 * opens the collection first, so a spec never has to navigate on its own.
 */
export class CollectionFlow extends BaseFlow {
  /** Opens `collection` from the sidebar and returns its tab bar's page. */
  @step()
  async open(collection: Collection): Promise<CollectionPage> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);
    const collectionPage = this.pageManager.collectionPage;
    await collectionPage.navigate();
    return collectionPage;
  }

  /** The collection's tab labels, left to right. */
  @step()
  async getTabNames(collection: Collection): Promise<string[]> {
    return (await this.open(collection)).getTabNames();
  }

  @step()
  async setBasicAuth(collection: Collection, fields: Partial<AuthTypeBasic>): Promise<void> {
    await (await this.open(collection)).auth.setBasicFields(fields);
  }

  @step()
  async setBearerAuth(collection: Collection, fields: Partial<AuthTypeBearer>): Promise<void> {
    await (await this.open(collection)).auth.setBearerFields(fields);
  }

  @step()
  async setApiKeyAuth(collection: Collection, fields: Partial<AuthTypeAPIKey>): Promise<void> {
    await (await this.open(collection)).auth.setApiKeyFields(fields);
  }

  @step()
  async setOAuth2(collection: Collection, fields: Partial<AuthTypeOAuth2>): Promise<void> {
    await (await this.open(collection)).auth.setOAuth2Fields(fields);
  }

  /** Clicks the collection's OAuth 2.0 "Fetch Tokens" button and reads the tokens back. */
  @step()
  async fetchOAuth2Tokens(collection: Collection): Promise<OAuth2Tokens> {
    const page = await this.open(collection);
    await page.auth.fetchOAuth2Tokens();
    return page.auth.getOAuth2Tokens();
  }

  /** Reads the OAuth 2.0 tokens currently stored for the collection, without fetching new ones. */
  @step()
  async getOAuth2Tokens(collection: Collection): Promise<OAuth2Tokens> {
    return (await this.open(collection)).auth.getOAuth2Tokens();
  }

  /** Clears the collection's auth (the "Inherit from parent" option, i.e. unset). */
  @step()
  async clearAuth(collection: Collection): Promise<void> {
    await (await this.open(collection)).auth.setInheritAuthentication();
  }

  @step()
  async setHeaders(collection: Collection, headers: KeyValueRow[]): Promise<void> {
    await (await this.open(collection)).headers.setHeaders(headers);
  }

  @step()
  async getHeaders(collection: Collection): Promise<KeyValueRow[]> {
    return (await this.open(collection)).headers.getHeaders();
  }

  @step()
  async setScripts(collection: Collection, scripts: RequestScripts): Promise<void> {
    await (await this.open(collection)).scripts.setScripts(scripts);
  }

  @step()
  async setDocs(collection: Collection, text: string): Promise<void> {
    await (await this.open(collection)).docs.setDocs(text);
  }

  @step()
  async getDocs(collection: Collection): Promise<string> {
    return (await this.open(collection)).docs.getDocs();
  }

  /** Opens the collection's Environment tab and returns its in-place editor. */
  @step()
  async openEnvironmentTab(collection: Collection): Promise<WorkspaceEnvironmentsComponent> {
    const page = await this.open(collection);
    await page.switchTab("environment");
    return page.environment;
  }

  /**
   * Opens the "Manage Environments" modal through the environment dropdown
   * and returns its editor. Close it with `closeEnvironmentModal()`.
   */
  @step()
  async openEnvironmentModal(collection: Collection): Promise<WorkspaceEnvironmentsComponent> {
    const page = await this.open(collection);
    return page.openEnvironmentModal();
  }

  @step()
  async closeEnvironmentModal(): Promise<void> {
    await this.pageManager.collectionPage.closeEnvironmentModal();
  }
}
