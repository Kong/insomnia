import type {
  ApiSpec,
  Environment,
  GitRepository,
  GrpcRequest,
  GrpcRequestMeta,
  McpRequest,
  MockServer,
  Project,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequest,
  SocketIORequestMeta,
  WebSocketRequest,
  WebSocketRequestMeta,
  Workspace,
  WorkspaceMeta,
  WorkspaceScope,
} from 'insomnia-data';

// Lists render examples from summaries; bodies live only in the example
// editor's own query, so workspace-wide reads never ship example bodies.
import type { ExampleSummary } from '../models/example';

export type ProjectWithGitRepository = Project & { gitRepository?: GitRepository };

export interface OrganizationData {
  projects: ProjectWithGitRepository[];
  workspaces: Workspace[];
  workspaceMetas: WorkspaceMeta[];
}

interface CommonWorkspaceChildren<TChildren, TChildrenMeta extends object = {}> {
  data: TChildren;
  dataMetas: TChildrenMeta;
}

type CollectionChildDoc = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;

// Lists render examples from summaries; bodies live only in the example editor's
// own query, so a workspace-wide read never ships example bodies.
export type { CollectionChildDoc };

type CollectionRequestMeta = RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta;

export interface CollectionWorkspaceChildren
  extends CommonWorkspaceChildren<
    { requestsAndGroups: CollectionChildDoc[]; examples: ExampleSummary[] },
    {
      allRequestMetas: CollectionRequestMeta[];
      requestGroupMetas: RequestGroupMeta[];
    }
  > {}

export interface MockServerWorkspaceChildren extends CommonWorkspaceChildren<{ mockServer?: MockServer }> {}

export interface DesignWorkspaceChildren
  extends CommonWorkspaceChildren<
    { apiSpec?: ApiSpec; requestsAndGroups: CollectionChildDoc[]; examples: ExampleSummary[] },
    {
      allRequestMetas: CollectionRequestMeta[];
      requestGroupMetas: RequestGroupMeta[];
    }
  > {}

export interface EnvironmentWorkspaceChildren extends CommonWorkspaceChildren<{ baseEnvironment: Environment }> {}

export interface McpWorkspaceChildren extends CommonWorkspaceChildren<{ mcpRequest: McpRequest }> {}

export type WorkspaceChildren =
  | CollectionWorkspaceChildren
  | MockServerWorkspaceChildren
  | DesignWorkspaceChildren
  | EnvironmentWorkspaceChildren
  | McpWorkspaceChildren;

interface ScopeToChildren {
  'collection': CollectionWorkspaceChildren;
  'design': DesignWorkspaceChildren;
  'mock-server': MockServerWorkspaceChildren;
  'environment': EnvironmentWorkspaceChildren;
  'mcp': McpWorkspaceChildren;
}

// Maps workspace's `scope` to its specific children shape, instead of the full WorkspaceChildren union
export type WorkspaceChildrenForScope<S extends WorkspaceScope | undefined> = S extends WorkspaceScope
  ? ScopeToChildren[S]
  : WorkspaceChildren;
