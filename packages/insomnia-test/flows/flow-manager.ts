import type { ElectronApplication } from "@playwright/test";

import type { PageManager } from "../pages/page-manager";
import { AppFlow } from "./app.flow";
import { CertificatesFlow } from "./certificates.flow";
import { CloudSyncFlow } from "./cloud-sync.flow";
import { CookieFlow } from "./cookie.flow";
import { EnvironmentFlow } from "./environment.flow";
import { EventStreamRequestFlow } from "./event-stream-request.flow";
import { ExportFlow } from "./export.flow";
import type { AppLaunchConfig, FlowContext } from "./flow-context";
import { FolderFlow } from "./folder.flow";
import { GitSyncFlow } from "./git-sync.flow";
import { GraphQLRequestFlow } from "./graphql-request.flow";
import { GrpcRequestFlow } from "./grpc-request.flow";
import { HttpRequestFlow } from "./http-request.flow";
import { ImportFlow } from "./import.flow";
import { McpClientFlow } from "./mcp-client.flow";
import { MockServerFlow } from "./mock-server.flow";
import { OrganizationFlow } from "./organization.flow";
import { PreferencesFlow } from "./preferences.flow";
import { SocketIORequestFlow } from "./socket-io-request.flow";
import { TemplateTagFlow } from "./template-tag.flow";
import { VariableSourceFlow } from "./variable-source.flow";
import { WebSocketRequestFlow } from "./web-socket-request.flow";
import type { RequestFlows } from "./workspace.flow";
import { WorkspaceFlow } from "./workspace.flow";

// Narrow view of the manager that factories depend on; kept separate from
// `FlowManager` so the registry's types do not refer back to themselves.
type FlowDeps = FlowContext & RequestFlows & {
  readonly pageManager: PageManager;
  readonly gitRepoUrl?: string;
  readonly workspaceFlow: WorkspaceFlow;
  readonly preferencesFlow: PreferencesFlow;
};

const flowRegistry = {
  appFlow: (m: FlowDeps): AppFlow => new AppFlow(m, m.pageManager),
  certificatesFlow: (m: FlowDeps): CertificatesFlow => new CertificatesFlow(m, m.pageManager),
  cloudSyncFlow: (m: FlowDeps): CloudSyncFlow => new CloudSyncFlow(m, m.pageManager),
  cookieFlow: (m: FlowDeps): CookieFlow => new CookieFlow(m, m.pageManager),
  environmentFlow: (m: FlowDeps): EnvironmentFlow => new EnvironmentFlow(m, m.pageManager, m.workspaceFlow),
  eventStreamRequestFlow: (m: FlowDeps): EventStreamRequestFlow => new EventStreamRequestFlow(m, m.pageManager),
  exportFlow: (m: FlowDeps): ExportFlow => new ExportFlow(m, m.pageManager),
  folderFlow: (m: FlowDeps): FolderFlow => new FolderFlow(m, m.pageManager),
  gitSyncFlow: (m: FlowDeps): GitSyncFlow => new GitSyncFlow(m, m.pageManager),
  graphqlRequestFlow: (m: FlowDeps): GraphQLRequestFlow => new GraphQLRequestFlow(m, m.pageManager),
  grpcRequestFlow: (m: FlowDeps): GrpcRequestFlow => new GrpcRequestFlow(m, m.pageManager),
  httpRequestFlow: (m: FlowDeps): HttpRequestFlow => new HttpRequestFlow(m, m.pageManager),
  importFlow: (m: FlowDeps): ImportFlow => new ImportFlow(m, m.pageManager),
  mcpClientFlow: (m: FlowDeps): McpClientFlow => new McpClientFlow(m, m.pageManager, m.workspaceFlow),
  mockServerFlow: (m: FlowDeps): MockServerFlow => new MockServerFlow(m, m.pageManager),
  organizationFlow: (m: FlowDeps): OrganizationFlow => new OrganizationFlow(m, m.pageManager),
  preferencesFlow: (m: FlowDeps): PreferencesFlow => new PreferencesFlow(m, m.pageManager),
  socketIoRequestFlow: (m: FlowDeps): SocketIORequestFlow => new SocketIORequestFlow(m, m.pageManager),
  templateTagFlow: (m: FlowDeps): TemplateTagFlow => new TemplateTagFlow(m, m.pageManager),
  variableSourceFlow: (m: FlowDeps): VariableSourceFlow => new VariableSourceFlow(m, m.pageManager),
  webSocketRequestFlow: (m: FlowDeps): WebSocketRequestFlow => new WebSocketRequestFlow(m, m.pageManager),
  workspaceFlow: (m: FlowDeps): WorkspaceFlow =>
    new WorkspaceFlow(m, m.pageManager, m.preferencesFlow, m, m.gitRepoUrl),
} satisfies Record<string, (m: FlowDeps) => unknown>;

type FlowName = Extract<keyof typeof flowRegistry, string>;

type Flows = { [K in keyof typeof flowRegistry]: ReturnType<(typeof flowRegistry)[K]> };

// Typed by the `FlowManager` interface merged below; the getters themselves
// are installed from `flowRegistry` in the static block.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class FlowManager implements FlowContext {
  private readonly flows = new Map<string, unknown>();

  constructor(
    readonly pageManager: PageManager,
    private insomnia?: ElectronApplication,
    readonly gitRepoUrl?: string,
    private readonly appLaunchConfig?: AppLaunchConfig,
  ) {}

  /**
   * The underlying ElectronApplication handle, for AppFlow to reach the
   * main process directly without going through a DOM-facing Page.
   */
  get electronApp(): ElectronApplication | undefined {
    return this.insomnia;
  }

  /**
   * The launch parameters this session's `insomnia` fixture originally
   * used — see `AppFlow.restart()`.
   */
  get launchConfig(): AppLaunchConfig | undefined {
    return this.appLaunchConfig;
  }

  /**
   * Rewires `electronApp` onto a freshly-relaunched ElectronApplication —
   * called by `AppFlow.restart()` once the new app is up.
   */
  setElectronApp(insomnia: ElectronApplication): void {
    this.insomnia = insomnia;
  }

  /**
   * Reads the main process's `userData` directory.
   */
  async getDataPath(): Promise<string> {
    return this.insomnia!.evaluate(({ app }) => app.getPath("userData"));
  }

  private getOrCreate(name: FlowName): unknown {
    if (!this.flows.has(name)) {
      this.flows.set(name, flowRegistry[name](this as unknown as FlowDeps));
    }
    return this.flows.get(name);
  }

  static {
    for (const name of Object.keys(flowRegistry) as FlowName[]) {
      Object.defineProperty(this.prototype, name, {
        get(this: FlowManager) {
          return this.getOrCreate(name);
        },
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface FlowManager extends Flows {}
