import type { BaseComponent } from "@package/components/base.component";
import { PreferencesComponent } from "@package/components/preferences.component";
import { PreferencesAiComponent } from "@package/components/preferences-ai.component";
import { PreferencesCredentialsComponent } from "@package/components/preferences-credentials.component";
import { PreferencesPluginsComponent } from "@package/components/preferences-plugins.component";
import { PreferencesVaultComponent } from "@package/components/preferences-vault.component";
import { findDocs } from "@package/misc/db";
import type { Page } from "playwright-core";

import type { BasePage } from "./base.page";
import { CertificatesPage } from "./certificates.page";
import { CloudSyncPage } from "./cloud-sync.page";
import { CloudSyncBranchesDialogPage } from "./cloud-sync-branches-dialog.page";
import { CloudSyncCommitDialogPage } from "./cloud-sync-commit-dialog.page";
import { CloudSyncFileDeletePage } from "./cloud-sync-file-delete.page";
import { CloudSyncHistoryDialogPage } from "./cloud-sync-history-dialog.page";
import { CommandPalettePage } from "./command-palette.page";
import { CookiePage } from "./cookie.page";
import { EnvironmentPage } from "./environment.page";
import { EventStreamRequestPage } from "./event-stream-request.page";
import { ExportPage } from "./export.page";
import { FolderPage } from "./folder.page";
import { GitBranchesDialogPage } from "./git-branches-dialog.page";
import { GitCommitDialogPage } from "./git-commit-dialog.page";
import { GitHistoryDialogPage } from "./git-history-dialog.page";
import { GitSyncPage } from "./git-sync.page";
import { GraphQLRequestPage } from "./graphql-request.page";
import { GrpcRequestPage } from "./grpc-request.page";
import { HttpRequestPage } from "./http-request.page";
import { ImportPage } from "./import.page";
import { InvitePage } from "./invite.page";
import { KonnectPage } from "./konnect.page";
import { McpClientPage } from "./mcp-client.page";
import { MockServerPage } from "./mock-server.page";
import { ProjectPage } from "./project.page";
import { ProjectSettingsPage } from "./project-settings.page";
import { ResponsePage } from "./response.page";
import { RunnerPage } from "./runner.page";
import { SocketIORequestPage } from "./socket-io-request.page";
import { SpecPage } from "./spec.page";
import { TemplateTagPage } from "./template-tag.page";
import { VariableSourcePage } from "./variable-source.page";
import { WebSocketRequestPage } from "./web-socket-request.page";
import { WorkspacePage } from "./workspace.page";

const pageRegistry = {
  certificatesPage: (page: Page): CertificatesPage =>
    new CertificatesPage(page),
  cloudSyncPage: (page: Page): CloudSyncPage =>
    new CloudSyncPage(page),
  commandPalettePage: (page: Page): CommandPalettePage =>
    new CommandPalettePage(page),
  cookiePage: (page: Page): CookiePage =>
    new CookiePage(page),
  environmentPage: (page: Page): EnvironmentPage =>
    new EnvironmentPage(page),
  eventStreamRequestPage: (page: Page): EventStreamRequestPage =>
    new EventStreamRequestPage(page),
  exportPage: (page: Page): ExportPage =>
    new ExportPage(page),
  folderPage: (page: Page): FolderPage =>
    new FolderPage(page),
  gitSyncPage: (page: Page): GitSyncPage =>
    new GitSyncPage(page),
  gitCommitDialogPage: (page: Page): GitCommitDialogPage =>
    new GitCommitDialogPage(page),
  gitBranchesDialogPage: (page: Page): GitBranchesDialogPage =>
    new GitBranchesDialogPage(page),
  gitHistoryDialogPage: (page: Page): GitHistoryDialogPage =>
    new GitHistoryDialogPage(page),
  graphqlRequestPage: (page: Page): GraphQLRequestPage =>
    new GraphQLRequestPage(page),
  grpcRequestPage: (page: Page): GrpcRequestPage =>
    new GrpcRequestPage(page),
  httpRequestPage: (page: Page): HttpRequestPage =>
    new HttpRequestPage(page),
  // Global dialogs reachable from any page, so components rather than pages.
  preferences: (page: Page): PreferencesComponent =>
    new PreferencesComponent(page),
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
