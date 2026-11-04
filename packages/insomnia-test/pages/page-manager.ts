import type { BaseComponent } from "@package/components/base.component";
import { PreferencesComponent } from "@package/components/preferences.component";
import { PreferencesAiComponent } from "@package/components/preferences-ai.component";
import { PreferencesCredentialsComponent } from "@package/components/preferences-credentials.component";
import { PreferencesPluginsComponent } from "@package/components/preferences-plugins.component";
import { PreferencesVaultComponent } from "@package/components/preferences-vault.component";
import { findDocs } from "@package/misc/db";
import type { Page } from "playwright-core";

import type { BasePage } from "./base.page";
import { EnvironmentPage } from "./environment.page";
import { HttpRequestPage } from "./http-request.page";
import { ProjectPage } from "./project.page";
import { ResponsePage } from "./response.page";
import { SpecPage } from "./spec.page";
import { WorkspacePage } from "./workspace.page";

const pageRegistry = {
  environmentPage: (page: Page): EnvironmentPage =>
    new EnvironmentPage(page),
  httpRequestPage: (page: Page): HttpRequestPage =>
    new HttpRequestPage(page),
  // Global dialogs reachable from any page, so components rather than pages.
  preferences: (page: Page): PreferencesComponent =>
    new PreferencesComponent(page),
  responsePage: (page: Page): ResponsePage =>
    new ResponsePage(page),
  preferencesCredentials: (page: Page): PreferencesCredentialsComponent =>
    new PreferencesCredentialsComponent(page),
  preferencesPlugins: (page: Page): PreferencesPluginsComponent =>
    new PreferencesPluginsComponent(page),
  preferencesAi: (page: Page): PreferencesAiComponent =>
    new PreferencesAiComponent(page),
  preferencesVault: (page: Page): PreferencesVaultComponent =>
    new PreferencesVaultComponent(page),
  cloudSyncCommitDialogPage: (page: Page): CloudSyncCommitDialogPage =>
    new CloudSyncCommitDialogPage(page),
  cloudSyncHistoryDialogPage: (page: Page): CloudSyncHistoryDialogPage =>
    new CloudSyncHistoryDialogPage(page),
  cloudSyncBranchesDialogPage: (page: Page): CloudSyncBranchesDialogPage =>
    new CloudSyncBranchesDialogPage(page),
  cloudSyncFileDeletePage: (page: Page): CloudSyncFileDeletePage =>
    new CloudSyncFileDeletePage(page),
  projectPage: (page: Page): ProjectPage =>
    new ProjectPage(page),
  specPage: (page: Page): SpecPage =>
    new SpecPage(page),
  workspacePage: (page: Page): WorkspacePage =>
    new WorkspacePage(page),
} satisfies Record<string, (page: Page) => BasePage | BaseComponent>;

type PageName = Extract<keyof typeof pageRegistry, string>;

type Pages = { [K in keyof typeof pageRegistry]: ReturnType<(typeof pageRegistry)[K]> };

// Typed by the `PageManager` interface merged below; the getters themselves
// are installed from `pageRegistry` in the static block.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PageManager {
  private readonly instances = new Map<string, unknown>();

  constructor(private page: Page) {}

  /** Queries the app's database through the current window. See `findDocs`. */
  findDocs(dbFile: string, query: Record<string, unknown> = {}): Promise<any[]> {
    return findDocs(this.page, dbFile, query);
  }

  /**
   * Rewires every already-created Page instance (and future ones) onto a
   * fresh window — called by `AppFlow.restart()`
   * once the relaunched app's first window is ready.
   */
  setWindow(page: Page): void {
    this.page = page;
    for (const instance of this.instances.values()) {
      (instance as BasePage).setContext(page);
    }
  }

  private getOrCreate(name: PageName): unknown {
    if (!this.instances.has(name)) {
      this.instances.set(name, pageRegistry[name](this.page));
    }
    return this.instances.get(name);
  }

  static {
    for (const name of Object.keys(pageRegistry) as PageName[]) {
      Object.defineProperty(this.prototype, name, {
        get(this: PageManager) {
          return this.getOrCreate(name);
        },
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface PageManager extends Pages {}
