import type { ElectronApplication } from "@playwright/test";
import { PageManager } from "../pages/page-manager";
import { AppFlow } from "./app.flow";
import { WorkspaceFlow } from "./workspace.flow";
import { HttpRequestFlow } from "./http-request.flow";
import { EventStreamRequestFlow } from "./event-stream-request.flow";
import { ExportFlow } from "./export.flow";
import { FolderFlow } from "./folder.flow";
import { GraphQLRequestFlow } from "./graphql-request.flow";
import { WebSocketRequestFlow } from "./web-socket-request.flow";
import { GrpcRequestFlow } from "./grpc-request.flow";
import { SocketIORequestFlow } from "./socket-io-request.flow";
import { ImportFlow } from "./import.flow";
import { McpClientFlow } from "./mcp-client.flow";
import { EnvironmentFlow } from "./environment.flow";
import { OrganizationFlow } from "./organization.flow";
import { CertificatesFlow } from "./certificates.flow";
import { CloudSyncFlow } from "./cloud-sync.flow";
import { CookieFlow } from "./cookie.flow";
import { GitSyncFlow } from "./git-sync.flow";
import { PreferencesFlow } from "./preferences.flow";
import { TemplateTagFlow } from "./template-tag.flow";
import { instrumentWithSteps } from "../misc/step-instrumentation";

/**
 * The `insomnia` fixture's original launch parameters — kept around so
 * `AppFlow.restart()` can relaunch against the same `dataPath` later
 * without re-deriving them.
 */
export type AppLaunchConfig = {
  dataPath: string;
  skipOnboarding: boolean;
  vaultKey: string;
  vaultSalt: string;
};

export class FlowManager {
  private _appFlow?: AppFlow;
  private _certificatesFlow?: CertificatesFlow;
  private _cloudSyncFlow?: CloudSyncFlow;
  private _cookieFlow?: CookieFlow;
  private _environmentFlow?: EnvironmentFlow;
  private _eventStreamRequestFlow?: EventStreamRequestFlow;
  private _exportFlow?: ExportFlow;
  private _folderFlow?: FolderFlow;
  private _gitSyncFlow?: GitSyncFlow;
  private _graphqlRequestFlow?: GraphQLRequestFlow;
  private _grpcRequestFlow?: GrpcRequestFlow;
  private _httpRequestFlow?: HttpRequestFlow;
  private _importFlow?: ImportFlow;
  private _mcpClientFlow?: McpClientFlow;
  private _organizationFlow?: OrganizationFlow;
  private _preferencesFlow?: PreferencesFlow;
  private _socketIoRequestFlow?: SocketIORequestFlow;
  private _templateTagFlow?: TemplateTagFlow;
  private _webSocketRequestFlow?: WebSocketRequestFlow;
  private _workspaceFlow?: WorkspaceFlow;

  constructor(
    private readonly pageManager: PageManager,
    private insomnia?: ElectronApplication,
    private readonly gitRepoUrl?: string,
    private readonly appLaunchConfig?: AppLaunchConfig,
  ) {}

  /**
   * The underlying ElectronApplication handle, for AppFlow to reach the
   * main process directly without going through a DOM-facing Page.
   * @returns The ElectronApplication handle, or undefined if none was passed in
   */
  get electronApp(): ElectronApplication | undefined {
    return this.insomnia;
  }

  /**
   * The launch parameters this session's `insomnia` fixture originally
   * used — see `AppFlow.restart()`.
   * @returns The original launch config, or undefined if none was passed in
   */
  get launchConfig(): AppLaunchConfig | undefined {
    return this.appLaunchConfig;
  }

  /**
   * Rewires `electronApp` onto a freshly-relaunched ElectronApplication —
   * called by `AppFlow.restart()` once the new app is up.
   * @param insomnia - The freshly-launched ElectronApplication
   */
  setElectronApp(insomnia: ElectronApplication): void {
    this.insomnia = insomnia;
  }

  get appFlow(): AppFlow {
    return (this._appFlow ??= instrumentWithSteps(
      new AppFlow(this, this.pageManager),
    ));
  }

  get certificatesFlow(): CertificatesFlow {
    return (this._certificatesFlow ??= instrumentWithSteps(
      new CertificatesFlow(this, this.pageManager),
    ));
  }

  get cloudSyncFlow(): CloudSyncFlow {
    return (this._cloudSyncFlow ??= instrumentWithSteps(
      new CloudSyncFlow(this, this.pageManager),
    ));
  }

  get cookieFlow(): CookieFlow {
    return (this._cookieFlow ??= instrumentWithSteps(
      new CookieFlow(this, this.pageManager),
    ));
  }

  get environmentFlow(): EnvironmentFlow {
    return (this._environmentFlow ??= instrumentWithSteps(
      new EnvironmentFlow(this, this.pageManager),
    ));
  }

  get eventStreamRequestFlow(): EventStreamRequestFlow {
    return (this._eventStreamRequestFlow ??= instrumentWithSteps(
      new EventStreamRequestFlow(this, this.pageManager),
    ));
  }

  get exportFlow(): ExportFlow {
    return (this._exportFlow ??= instrumentWithSteps(
      new ExportFlow(this, this.pageManager),
    ));
  }

  get folderFlow(): FolderFlow {
    return (this._folderFlow ??= instrumentWithSteps(
      new FolderFlow(this, this.pageManager),
    ));
  }

  get gitSyncFlow(): GitSyncFlow {
    return (this._gitSyncFlow ??= instrumentWithSteps(
      new GitSyncFlow(this, this.pageManager),
    ));
  }

  get graphqlRequestFlow(): GraphQLRequestFlow {
    return (this._graphqlRequestFlow ??= instrumentWithSteps(
      new GraphQLRequestFlow(this, this.pageManager),
    ));
  }

  get grpcRequestFlow(): GrpcRequestFlow {
    return (this._grpcRequestFlow ??= instrumentWithSteps(
      new GrpcRequestFlow(this, this.pageManager),
    ));
  }

  get httpRequestFlow(): HttpRequestFlow {
    return (this._httpRequestFlow ??= instrumentWithSteps(
      new HttpRequestFlow(this, this.pageManager),
    ));
  }

  get importFlow(): ImportFlow {
    return (this._importFlow ??= instrumentWithSteps(
      new ImportFlow(this, this.pageManager),
    ));
  }

  get mcpClientFlow(): McpClientFlow {
    return (this._mcpClientFlow ??= instrumentWithSteps(
      new McpClientFlow(this, this.pageManager),
    ));
  }

  get organizationFlow(): OrganizationFlow {
    return (this._organizationFlow ??= instrumentWithSteps(
      new OrganizationFlow(this, this.pageManager),
    ));
  }

  get preferencesFlow(): PreferencesFlow {
    return (this._preferencesFlow ??= instrumentWithSteps(
      new PreferencesFlow(this, this.pageManager),
    ));
  }

  get socketIoRequestFlow(): SocketIORequestFlow {
    return (this._socketIoRequestFlow ??= instrumentWithSteps(
      new SocketIORequestFlow(this, this.pageManager),
    ));
  }

  get templateTagFlow(): TemplateTagFlow {
    return (this._templateTagFlow ??= instrumentWithSteps(
      new TemplateTagFlow(this, this.pageManager),
    ));
  }

  get webSocketRequestFlow(): WebSocketRequestFlow {
    return (this._webSocketRequestFlow ??= instrumentWithSteps(
      new WebSocketRequestFlow(this, this.pageManager),
    ));
  }

  get workspaceFlow(): WorkspaceFlow {
    return (this._workspaceFlow ??= instrumentWithSteps(
      new WorkspaceFlow(this, this.pageManager, this.gitRepoUrl),
    ));
  }
}
