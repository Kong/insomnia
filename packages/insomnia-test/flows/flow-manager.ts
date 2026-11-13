import type { FlowContext } from "@package/misc/flow-context";
import type { PageManager } from "@package/pages/page-manager";

import { AppFlow } from "./app.flow";
import { CollectionFlow } from "./collection.flow";
import { EnvironmentFlow } from "./environment.flow";
import { ExportFlow } from "./export.flow";
import { FolderFlow } from "./folder.flow";
import { GrpcRequestFlow } from "./grpc-request.flow";
import { HttpRequestFlow } from "./http-request.flow";
import { ImportFlow } from "./import.flow";
import { InsoFlow } from "./inso.flow";
import { PreferencesFlow } from "./preferences.flow";
import { SocketIORequestFlow } from "./socket-io-request.flow";
import { WebSocketRequestFlow } from "./web-socket-request.flow";
import type { RequestFlows } from "./workspace.flow";
import { WorkspaceFlow } from "./workspace.flow";

// Narrow view of the manager that factories depend on; kept separate from
// `FlowManager` so the registry's types do not refer back to themselves.
type FlowDeps = RequestFlows & {
  readonly context: FlowContext;
  readonly pageManager: PageManager;
  readonly gitRepoUrl?: string;
  readonly workspaceFlow: WorkspaceFlow;
  readonly preferencesFlow: PreferencesFlow;
};

const flowRegistry = {
  appFlow: (m: FlowDeps): AppFlow => new AppFlow(m.context, m.pageManager),
  collectionFlow: (m: FlowDeps): CollectionFlow => new CollectionFlow(m.context, m.pageManager),
  environmentFlow: (m: FlowDeps): EnvironmentFlow => new EnvironmentFlow(m.context, m.pageManager, m.workspaceFlow),
  exportFlow: (m: FlowDeps): ExportFlow => new ExportFlow(m.context, m.pageManager),
  folderFlow: (m: FlowDeps): FolderFlow => new FolderFlow(m.context, m.pageManager),
  grpcRequestFlow: (m: FlowDeps): GrpcRequestFlow => new GrpcRequestFlow(m.context, m.pageManager),
  httpRequestFlow: (m: FlowDeps): HttpRequestFlow => new HttpRequestFlow(m.context, m.pageManager),
  importFlow: (m: FlowDeps): ImportFlow => new ImportFlow(m.context, m.pageManager),
  insoFlow: (m: FlowDeps): InsoFlow => new InsoFlow(m.context, m.pageManager),
  preferencesFlow: (m: FlowDeps): PreferencesFlow => new PreferencesFlow(m.context, m.pageManager),
  socketIoRequestFlow: (m: FlowDeps): SocketIORequestFlow => new SocketIORequestFlow(m.context, m.pageManager),
  webSocketRequestFlow: (m: FlowDeps): WebSocketRequestFlow => new WebSocketRequestFlow(m.context, m.pageManager),
  workspaceFlow: (m: FlowDeps): WorkspaceFlow =>
    new WorkspaceFlow(m.context, m.pageManager, m.preferencesFlow, m, m.gitRepoUrl),
} satisfies Record<string, (m: FlowDeps) => unknown>;

type FlowName = Extract<keyof typeof flowRegistry, string>;

type Flows = { [K in keyof typeof flowRegistry]: ReturnType<(typeof flowRegistry)[K]> };

// Typed by the `FlowManager` interface merged below; the getters themselves
// are installed from `flowRegistry` in the static block.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class FlowManager {
  private readonly flows = new Map<string, unknown>();

  constructor(
    readonly pageManager: PageManager,
    readonly context: FlowContext,
    readonly gitRepoUrl?: string,
  ) {}

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
