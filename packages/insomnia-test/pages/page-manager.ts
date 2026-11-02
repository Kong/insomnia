import type { ElectronApplication } from "@playwright/test";
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

export class PageManager {
  private readonly instances = new Map<string, unknown>();

  constructor(
    private page: Page,
    private insomnia?: ElectronApplication,
  ) {}

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

  /**
   * Lazily creates (and caches) the CertificatesPage instance.
   */
  get certificatesPage(): CertificatesPage {
    return this.getOrCreate("certificates", () => new CertificatesPage(this.page));
  }

  /**
   * Lazily creates (and caches) the CloudSyncPage instance.
   */
  get cloudSyncPage(): CloudSyncPage {
    return this.getOrCreate("cloudSync", () => new CloudSyncPage(this.page));
  }

  /**
   * Lazily creates (and caches) the CommandPalettePage instance.
   */
  get commandPalettePage(): CommandPalettePage {
    return this.getOrCreate(
      "commandPalette",
      () => new CommandPalettePage(this.page),
    );
  }

  /**
   * Lazily creates (and caches) the CookiePage instance.
   */
  get cookiePage(): CookiePage {
    return this.getOrCreate("cookie", () => new CookiePage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the EnvironmentPage instance.
   */
  get environmentPage(): EnvironmentPage {
    return this.getOrCreate(
      "environment",
      () => new EnvironmentPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the EventStreamRequestPage instance.
   */
  get eventStreamRequestPage(): EventStreamRequestPage {
    return this.getOrCreate(
      "eventStreamRequest",
      () => new EventStreamRequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the ExportPage instance.
   */
  get exportPage(): ExportPage {
    return this.getOrCreate(
      "export",
      () => new ExportPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the FolderPage instance.
   */
  get folderPage(): FolderPage {
    return this.getOrCreate("folder", () => new FolderPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the GitSyncPage instance.
   */
  get gitSyncPage(): GitSyncPage {
    return this.getOrCreate(
      "gitSync",
      () => new GitSyncPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the GitCommitDialogPage instance.
   */
  get gitCommitDialogPage(): GitCommitDialogPage {
    return this.getOrCreate("gitCommitDialog", () => new GitCommitDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the GitBranchesDialogPage instance.
   */
  get gitBranchesDialogPage(): GitBranchesDialogPage {
    return this.getOrCreate("gitBranchesDialog", () => new GitBranchesDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the GitHistoryDialogPage instance.
   */
  get gitHistoryDialogPage(): GitHistoryDialogPage {
    return this.getOrCreate("gitHistoryDialog", () => new GitHistoryDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the GraphQLRequestPage instance.
   */
  get graphqlRequestPage(): GraphQLRequestPage {
    return this.getOrCreate(
      "graphqlRequest",
      () => new GraphQLRequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the GrpcRequestPage instance.
   */
  get grpcRequestPage(): GrpcRequestPage {
    return this.getOrCreate(
      "grpcRequest",
      () => new GrpcRequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the HttpRequestPage instance.
   */
  get httpRequestPage(): HttpRequestPage {
    return this.getOrCreate(
      "httpRequest",
      () => new HttpRequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the ImportPage instance.
   */
  get importPage(): ImportPage {
    return this.getOrCreate("import", () => new ImportPage(this.page));
  }

  /**
   * Lazily creates (and caches) the InvitePage instance.
   */
  get invitePage(): InvitePage {
    return this.getOrCreate("invite", () => new InvitePage(this.page));
  }

  /**
   * Lazily creates (and caches) the KonnectPage instance.
   */
  get konnectPage(): KonnectPage {
    return this.getOrCreate("konnect", () => new KonnectPage(this.page));
  }

  /**
   * Lazily creates (and caches) the McpClientPage instance.
   */
  get mcpClientPage(): McpClientPage {
    return this.getOrCreate("mcpClient", () => new McpClientPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the MockServerPage instance.
   */
  get mockServerPage(): MockServerPage {
    return this.getOrCreate(
      "mockServer",
      () => new MockServerPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the PreferencesPage instance.
   */
  get preferencesPage(): PreferencesPage {
    return this.getOrCreate(
      "preferences",
      () => new PreferencesPage(this.page),
    );
  }

  /**
   * Lazily creates (and caches) the ProjectSettingsPage instance.
   */
  get projectSettingsPage(): ProjectSettingsPage {
    return this.getOrCreate(
      "projectSettings",
      () => new ProjectSettingsPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the ResponsePage instance.
   */
  get responsePage(): ResponsePage {
    return this.getOrCreate("response", () => new ResponsePage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the RunnerPage instance.
   */
  get runnerPage(): RunnerPage {
    return this.getOrCreate(
      "runner",
      () => new RunnerPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the SocketIORequestPage instance.
   */
  get socketIoRequestPage(): SocketIORequestPage {
    return this.getOrCreate(
      "socketIoRequest",
      () => new SocketIORequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the TemplateTagPage instance.
   */
  get templateTagPage(): TemplateTagPage {
    return this.getOrCreate(
      "templateTag",
      () => new TemplateTagPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the VariableSourcePage instance.
   */
  get variableSourcePage(): VariableSourcePage {
    return this.getOrCreate(
      "variableSource",
      () => new VariableSourcePage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the WebSocketRequestPage instance.
   */
  get webSocketRequestPage(): WebSocketRequestPage {
    return this.getOrCreate(
      "webSocketRequest",
      () => new WebSocketRequestPage(this.page, this.insomnia),
    );
  }

  /**
   * Lazily creates (and caches) the PreferencesCredentialsPage instance.
   */
  get preferencesCredentialsPage(): PreferencesCredentialsPage {
    return this.getOrCreate("preferencesCredentials", () => new PreferencesCredentialsPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the PreferencesPluginsPage instance.
   */
  get preferencesPluginsPage(): PreferencesPluginsPage {
    return this.getOrCreate("preferencesPlugins", () => new PreferencesPluginsPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the PreferencesAiPage instance.
   */
  get preferencesAiPage(): PreferencesAiPage {
    return this.getOrCreate("preferencesAi", () => new PreferencesAiPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the PreferencesVaultPage instance.
   */
  get preferencesVaultPage(): PreferencesVaultPage {
    return this.getOrCreate("preferencesVault", () => new PreferencesVaultPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the CloudSyncCommitDialogPage instance.
   */
  get cloudSyncCommitDialogPage(): CloudSyncCommitDialogPage {
    return this.getOrCreate("cloudSyncCommitDialog", () => new CloudSyncCommitDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the CloudSyncHistoryDialogPage instance.
   */
  get cloudSyncHistoryDialogPage(): CloudSyncHistoryDialogPage {
    return this.getOrCreate("cloudSyncHistoryDialog", () => new CloudSyncHistoryDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the CloudSyncBranchesDialogPage instance.
   */
  get cloudSyncBranchesDialogPage(): CloudSyncBranchesDialogPage {
    return this.getOrCreate("cloudSyncBranchesDialog", () => new CloudSyncBranchesDialogPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the CloudSyncFileDeletePage instance.
   */
  get cloudSyncFileDeletePage(): CloudSyncFileDeletePage {
    return this.getOrCreate("cloudSyncFileDelete", () => new CloudSyncFileDeletePage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the ProjectPage instance.
   */
  get projectPage(): ProjectPage {
    return this.getOrCreate("project", () => new ProjectPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the SpecPage instance.
   */
  get specPage(): SpecPage {
    return this.getOrCreate("spec", () => new SpecPage(this.page, this.insomnia));
  }

  /**
   * Lazily creates (and caches) the WorkspacePage instance.
   */
  get workspacePage(): WorkspacePage {
    return this.getOrCreate("workspace", () => new WorkspacePage(this.page, this.insomnia));
  }

  private getOrCreate<T extends object>(key: string, factory: () => T): T {
    if (!this.instances.has(key)) this.instances.set(key, factory());
    return this.instances.get(key) as T;
  }
}
