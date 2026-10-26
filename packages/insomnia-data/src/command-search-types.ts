import type { Environment, GrpcRequest, Request, WebSocketRequest, Workspace } from './models/types';

export interface CommandSearchResult {
  requestId: string;
  current: {
    requests: {
      id: string;
      url: string;
      name: string;
      item: Request | GrpcRequest | WebSocketRequest;
      organizationName: string;
      projectName: string;
      workspaceName: string;
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }[];
    files: {
      id: string;
      url: string;
      name: string;
      item: Workspace & { teamProjectId: string };
      organizationName: string;
      projectName: string;
      organizationId: string;
      projectId: string;
    }[];
    environments: Environment[];
  };
  other: {
    requests: {
      id: string;
      url: string;
      name: string;
      item: Request | GrpcRequest | WebSocketRequest;
      organizationName: string;
      projectName: string;
      workspaceName: string;
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }[];
    files: {
      id: string;
      url: string;
      name: string;
      item: Workspace & { teamProjectId: string };
      organizationName: string;
      projectName: string;
      organizationId: string;
      projectId: string;
    }[];
  };
}
