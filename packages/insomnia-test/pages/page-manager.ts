import type { ElectronApplication } from "@playwright/test";
import type { Page } from "playwright-core";

import { findDocs } from "../misc/db";
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
import { PreferencesPage } from "./preferences.page";
import { PreferencesAiPage } from "./preferences-ai.page";
import { PreferencesCredentialsPage } from "./preferences-credentials.page";
import { PreferencesPluginsPage } from "./preferences-plugins.page";
import { PreferencesVaultPage } from "./preferences-vault.page";
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
  certificatesPage: (page: Page, insomnia?: ElectronApplication): CertificatesPage =>
    new CertificatesPage(page),
  cloudSyncPage: (page: Page, insomnia?: ElectronApplication): CloudSyncPage =>
    new CloudSyncPage(page),
  commandPalettePage: (page: Page, insomnia?: ElectronApplication): CommandPalettePage =>
    new CommandPalettePage(page),
  cookiePage: (page: Page, insomnia?: ElectronApplication): CookiePage =>
    new CookiePage(page, insomnia),
  environmentPage: (page: Page, insomnia?: ElectronApplication): EnvironmentPage =>
    new EnvironmentPage(page, insomnia),
  eventStreamRequestPage: (page: Page, insomnia?: ElectronApplication): EventStreamRequestPage =>
    new EventStreamRequestPage(page, insomnia),
  exportPage: (page: Page, insomnia?: ElectronApplication): ExportPage =>
    new ExportPage(page, insomnia),
  folderPage: (page: Page, insomnia?: ElectronApplication): FolderPage =>
    new FolderPage(page, insomnia),
  gitSyncPage: (page: Page, insomnia?: ElectronApplication): GitSyncPage =>
    new GitSyncPage(page, insomnia),
  gitCommitDialogPage: (page: Page, insomnia?: ElectronApplication): GitCommitDialogPage =>
    new GitCommitDialogPage(page, insomnia),
  gitBranchesDialogPage: (page: Page, insomnia?: ElectronApplication): GitBranchesDialogPage =>
    new GitBranchesDialogPage(page, insomnia),
  gitHistoryDialogPage: (page: Page, insomnia?: ElectronApplication): GitHistoryDialogPage =>
    new GitHistoryDialogPage(page, insomnia),
  graphqlRequestPage: (page: Page, insomnia?: ElectronApplication): GraphQLRequestPage =>
    new GraphQLRequestPage(page, insomnia),
  grpcRequestPage: (page: Page, insomnia?: ElectronApplication): GrpcRequestPage =>
    new GrpcRequestPage(page, insomnia),
  httpRequestPage: (page: Page, insomnia?: ElectronApplication): HttpRequestPage =>
    new HttpRequestPage(page, insomnia),
  importPage: (page: Page, insomnia?: ElectronApplication): ImportPage =>
    new ImportPage(page),
  invitePage: (page: Page, insomnia?: ElectronApplication): InvitePage =>
    new InvitePage(page),
  konnectPage: (page: Page, insomnia?: ElectronApplication): KonnectPage =>
    new KonnectPage(page),
  mcpClientPage: (page: Page, insomnia?: ElectronApplication): McpClientPage =>
    new McpClientPage(page, insomnia),
  mockServerPage: (page: Page, insomnia?: ElectronApplication): MockServerPage =>
    new MockServerPage(page, insomnia),
  preferencesPage: (page: Page, insomnia?: ElectronApplication): PreferencesPage =>
    new PreferencesPage(page),
  projectSettingsPage: (page: Page, insomnia?: ElectronApplication): ProjectSettingsPage =>
    new ProjectSettingsPage(page, insomnia),
  responsePage: (page: Page, insomnia?: ElectronApplication): ResponsePage =>
    new ResponsePage(page, insomnia),
  runnerPage: (page: Page, insomnia?: ElectronApplication): RunnerPage =>
    new RunnerPage(page, insomnia),
  socketIoRequestPage: (page: Page, insomnia?: ElectronApplication): SocketIORequestPage =>
    new SocketIORequestPage(page, insomnia),
  templateTagPage: (page: Page, insomnia?: ElectronApplication): TemplateTagPage =>
    new TemplateTagPage(page, insomnia),
  variableSourcePage: (page: Page, insomnia?: ElectronApplication): VariableSourcePage =>
    new VariableSourcePage(page, insomnia),
  webSocketRequestPage: (page: Page, insomnia?: ElectronApplication): WebSocketRequestPage =>
    new WebSocketRequestPage(page, insomnia),
  preferencesCredentialsPage: (page: Page, insomnia?: ElectronApplication): PreferencesCredentialsPage =>
    new PreferencesCredentialsPage(page, insomnia),
  preferencesPluginsPage: (page: Page, insomnia?: ElectronApplication): PreferencesPluginsPage =>
    new PreferencesPluginsPage(page, insomnia),
  preferencesAiPage: (page: Page, insomnia?: ElectronApplication): PreferencesAiPage =>
    new PreferencesAiPage(page, insomnia),
  preferencesVaultPage: (page: Page, insomnia?: ElectronApplication): PreferencesVaultPage =>
    new PreferencesVaultPage(page, insomnia),
  cloudSyncCommitDialogPage: (page: Page, insomnia?: ElectronApplication): CloudSyncCommitDialogPage =>
    new CloudSyncCommitDialogPage(page, insomnia),
  cloudSyncHistoryDialogPage: (page: Page, insomnia?: ElectronApplication): CloudSyncHistoryDialogPage =>
    new CloudSyncHistoryDialogPage(page, insomnia),
  cloudSyncBranchesDialogPage: (page: Page, insomnia?: ElectronApplication): CloudSyncBranchesDialogPage =>
    new CloudSyncBranchesDialogPage(page, insomnia),
  cloudSyncFileDeletePage: (page: Page, insomnia?: ElectronApplication): CloudSyncFileDeletePage =>
    new CloudSyncFileDeletePage(page, insomnia),
  projectPage: (page: Page, insomnia?: ElectronApplication): ProjectPage =>
    new ProjectPage(page, insomnia),
  specPage: (page: Page, insomnia?: ElectronApplication): SpecPage =>
    new SpecPage(page, insomnia),
  workspacePage: (page: Page, insomnia?: ElectronApplication): WorkspacePage =>
    new WorkspacePage(page, insomnia),
} satisfies Record<string, (page: Page, insomnia?: ElectronApplication) => BasePage>;

type PageName = Extract<keyof typeof pageRegistry, string>;

type Pages = { [K in keyof typeof pageRegistry]: ReturnType<(typeof pageRegistry)[K]> };

// Typed by the `PageManager` interface merged below; the getters themselves
// are installed from `pageRegistry` in the static block.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PageManager {
  private readonly instances = new Map<string, unknown>();

  constructor(
    private page: Page,
    private insomnia?: ElectronApplication,
  ) {}

  /** Queries the app's database through the current window. See `findDocs`. */
  findDocs(dbFile: string, query: Record<string, unknown> = {}): Promise<any[]> {
    return findDocs(this.page, dbFile, query);
  }

  /**
   * Rewires every already-created Page instance (and future ones) onto a
   * fresh window/ElectronApplication — called by `AppFlow.restart()`
   * once the relaunched app's first window is ready.
   */
  setWindow(page: Page, insomnia?: ElectronApplication): void {
    this.page = page;
    this.insomnia = insomnia;
    for (const instance of this.instances.values()) {
      (instance as BasePage).setContext(page, insomnia);
    }
  }

  private getOrCreate(name: PageName): unknown {
    if (!this.instances.has(name)) {
      this.instances.set(name, pageRegistry[name](this.page, this.insomnia));
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
