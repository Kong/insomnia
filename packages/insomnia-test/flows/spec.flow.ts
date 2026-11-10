import { step } from "@package/misc/step";
import type {
  OutlineMethodBadge,
  WebhookEntry,
} from "@package/pages/spec.page";

import { BaseFlow } from "./base.flow";

export class SpecFlow extends BaseFlow {
  /**
   * Generates requests from the open collection's spec through the
   * toolbar's Generate -> Requests action. The requests land in the same
   * collection.
   */
  @step()
  async generateRequests(): Promise<void> {
    await this.pageManager.specPage.clickGenerateRequests();
  }

  /**
   * Reads whether Generate -> Requests is currently enabled for the open
   * collection's spec (it is disabled while the spec has lint errors).
   */
  @step()
  async isGenerateRequestsEnabled(): Promise<boolean> {
    return this.pageManager.specPage.isGenerateRequestsEnabled();
  }

  /**
   * Reads the OpenAPI version label shown in the spec toolbar, e.g.
   * `OpenAPI 3.2.0`.
   */
  @step()
  async getOpenApiVersion(): Promise<string> {
    return this.pageManager.specPage.getOpenApiVersion();
  }

  /**
   * Reads the open collection's spec text exactly as the editor holds it.
   */
  @step()
  async getSpecText(): Promise<string> {
    return this.pageManager.specPage.getSpecText();
  }

  /**
   * Reads the method badges shown on a path's outline row.
   */
  @step()
  async getPathMethodBadges(path: string): Promise<OutlineMethodBadge[]> {
    return this.pageManager.specPage.getPathMethodBadges(path);
  }

  /**
   * Clicks a path's method badge in the outline and reads where the
   * editor's selection lands.
   */
  @step()
  async jumpToPathMethod(
    path: string,
    method: string,
  ): Promise<{ line: number; text: string }> {
    const specPage = this.pageManager.specPage;
    await specPage.clickPathMethodBadge(path, method);
    return specPage.getEditorSelection();
  }

  /**
   * Reads the outline's Webhooks section: each webhook's name and method
   * badge labels.
   */
  @step()
  async getWebhooks(): Promise<WebhookEntry[]> {
    return this.pageManager.specPage.getWebhookEntries();
  }

  /**
   * Clicks a webhook's row in the outline and reads where the editor's
   * selection lands.
   */
  @step()
  async jumpToWebhook(
    name: string,
  ): Promise<{ line: number; text: string }> {
    const specPage = this.pageManager.specPage;
    await specPage.clickWebhookEntry(name);
    return specPage.getEditorSelection();
  }

  /**
   * Clicks one of a webhook's method badges (by method, e.g. `POST`) and
   * reads where the editor's selection lands.
   */
  @step()
  async jumpToWebhookMethod(
    name: string,
    method: string,
  ): Promise<{ line: number; text: string }> {
    const specPage = this.pageManager.specPage;
    await specPage.clickWebhookMethodBadge(name, method);
    return specPage.getEditorSelection();
  }
}
