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

export type ProjectWithGitRepository = Project & { gitRepository?: GitRepository };
export interface OrganizationData {
  projects: ProjectWithGitRepository[];
  workspaces: Workspace[];
  workspaceMetas: WorkspaceMeta[];
}

interface CommonWorkspaceChildren<TChildren, TChildrenMeta extends object = {}> {
  children: TChildren;
  childrenMetas: TChildrenMeta;
}

type CollectionChildDoc = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;
export type { CollectionChildDoc };

type CollectionRequestMeta = RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta;

export interface CollectionWorkspaceChildren
  extends CommonWorkspaceChildren<
    { requestsAndGroups: CollectionChildDoc[] },
    {
      allRequestMetas: CollectionRequestMeta[];
      requestGroupMetas: RequestGroupMeta[];
    }
  > {}

export interface MockServerWorkspaceChildren extends CommonWorkspaceChildren<{ mockServer: MockServer }> {}

export interface DesignWorkspaceChildren
  extends CommonWorkspaceChildren<
    { apiSpec?: ApiSpec; requestsAndGroups: CollectionChildDoc[] },
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

export type WorkspaceChildrenForScope<S extends WorkspaceScope | undefined> = S extends WorkspaceScope
  ? ScopeToChildren[S]
  : WorkspaceChildren;
