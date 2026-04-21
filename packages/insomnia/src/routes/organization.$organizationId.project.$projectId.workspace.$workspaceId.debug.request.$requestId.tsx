import { href, Outlet, redirect, useRouteLoaderData } from 'react-router';

import { database } from '~/common/database';
import type {
  GrpcRequest,
  GrpcRequestMeta,
  McpPayload,
  McpRequest,
  McpResponse,
  MockRoute,
  MockServer,
  Request,
  RequestMeta,
  RequestVersion,
  Response,
  SocketIOPayload,
  SocketIORequest,
  SocketIOResponse,
  WebSocketRequest,
  WebSocketResponse,
} from '~/insomnia-data';
import { services } from '~/insomnia-data';
import type { BaseModel } from '~/models';
import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { getBodyBuffer } from '~/models/helpers/response-operations';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
export default Outlet;
export interface WebSocketRequestLoaderData {
  activeRequest: WebSocketRequest;
  activeRequestMeta: RequestMeta;
  activeResponse: WebSocketResponse | null;
  responses: WebSocketResponse[];
  requestVersions: RequestVersion[];
}

export interface SocketIORequestLoaderData {
  activeRequest: SocketIORequest;
  activeRequestMeta: RequestMeta;
  activeResponse: SocketIOResponse;
  responses: SocketIOResponse[];
  requestVersions: RequestVersion[];
  requestPayload: SocketIOPayload;
}
export interface GrpcRequestLoaderData {
  activeRequest: GrpcRequest;
  activeRequestMeta: GrpcRequestMeta;
  activeResponse: null;
  responses: [];
  requestVersions: RequestVersion[];
}

export interface McpRequestLoaderData {
  activeRequest: McpRequest;
  activeRequestMeta: RequestMeta;
  activeResponse: McpResponse;
  responses: McpResponse[];
  requestVersions: RequestVersion[];
  requestPayload: McpPayload;
}
export interface RequestLoaderData {
  activeRequest: Request;
  activeRequestMeta: RequestMeta;
  activeResponse: Response | null;
  responses: Response[];
  requestVersions: RequestVersion[];
  mockServerAndRoutes: (MockServer & { routes: MockRoute[] })[];
}

const { isGraphqlSubscriptionRequest } = models.request;
const getResponseOperations = (request: Request | WebSocketRequest | SocketIORequest | GrpcRequest) => {
  const isGraphqlWsRequest = isGraphqlSubscriptionRequest(request);

  if (models.webSocketRequest.isWebSocketRequest(request) || isGraphqlWsRequest) {
    return services.webSocketResponse;
  }

  if (models.socketIORequest.isSocketIORequest(request)) {
    return services.socketIOResponse;
  }

  return services.response;
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, requestId, workspaceId } = params;

  const activeWorkspace = await services.workspace.getById(workspaceId);
  if (!activeWorkspace) {
    showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  const activeRequest = await requestOperations.getById(requestId);
  if (!activeRequest) {
    showResourceNotFoundToast(`Request not found: ${requestId}`);
    if (activeWorkspace.scope === 'mcp') {
      // Redirect to the project page if it is an MCP workspace, as an MCP workspace must have one request.
      throw redirect(
        href('/organization/:organizationId/project/:projectId', {
          organizationId,
          projectId,
        }),
      );
    }
    throw redirect(
      href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
        organizationId,
        projectId,
        workspaceId,
      }),
    );
  }
  const activeWorkspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  // NOTE: loaders shouldnt mutate data, this should be moved somewhere else
  await services.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: requestId });
  if (models.grpcRequest.isGrpcRequestId(requestId)) {
    return {
      activeRequest,
      activeRequestMeta: await services.grpcRequestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() }),
      activeResponse: null,
      responses: [],
      requestVersions: [],
    } as GrpcRequestLoaderData;
  }
  const activeRequestMeta = await services.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  const { filterResponsesByEnv } = await services.settings.get();
  const isGraphqlWsRequest = isGraphqlSubscriptionRequest(activeRequest);

  // Handle MCP requests early (like gRPC) since MCP response methods are on services
  if (models.mcpRequest.isMcpRequest(activeRequest)) {
    const activeResponse = activeRequestMeta.activeResponseId
      ? await services.mcpResponse.getById(activeRequestMeta.activeResponseId)
      : await services.mcpResponse.getLatestForRequestId(requestId, activeWorkspaceMeta.activeEnvironmentId);
    const allResponses = await database.find<McpResponse>(models.mcpResponse.type, { parentId: requestId });
    const filteredResponses = allResponses.filter(
      (r: McpResponse) => r.environmentId === activeWorkspaceMeta.activeEnvironmentId,
    );
    const responses = (filterResponsesByEnv ? filteredResponses : allResponses).sort((a: BaseModel, b: BaseModel) =>
      a.created > b.created ? -1 : 1,
    );
    const requestPayload = await services.mcpPayload.getByParentIdAndUrl(requestId, activeRequest.url);
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse: activeResponse || null,
      requestPayload,
      responses,
      requestVersions: await services.requestVersion.findByParentId(requestId),
    } as McpRequestLoaderData;
  }

  const responseOperations = getResponseOperations(activeRequest);

  const activeResponse = activeRequestMeta.activeResponseId
    ? await responseOperations.getById(activeRequestMeta.activeResponseId)
    : await responseOperations.getLatestForRequestId(requestId, activeWorkspaceMeta.activeEnvironmentId);
  const allResponses = (await responseOperations.findByParentId(requestId)) as (
    | Response
    | WebSocketResponse
    | SocketIOResponse
  )[];
  const filteredResponses = allResponses.filter(
    (r: Response | WebSocketResponse | SocketIOResponse) => r.environmentId === activeWorkspaceMeta.activeEnvironmentId,
  );
  const responses = (filterResponsesByEnv ? filteredResponses : allResponses).sort((a: BaseModel, b: BaseModel) =>
    a.created > b.created ? -1 : 1,
  );

  if (activeResponse && 'bodyPath' in activeResponse) {
    // read the body if its smaller than the limit add it to the activeResponse
    const length = Math.max(activeResponse.bytesContent, activeResponse.bytesRead);
    const isOversizedResponse = length > 5 * 1024 * 1024; // 5MB
    // Oversized repsonses are handled in the response-viewer.tsx for now
    if (!isOversizedResponse) {
      const buffer = await getBodyBuffer(activeResponse);
      activeResponse.bodyBuffer = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    }
  }

  // Q(gatzjames): load mock servers here or somewhere else?
  const mockServers = await services.mockServer.findByProjectId(projectId);
  const mockRoutes = await database.find<MockRoute>(models.mockRoute.type, {
    parentId: { $in: mockServers.map(s => s._id) },
  });
  const mockServerAndRoutes = mockServers.map(mockServer => ({
    ...mockServer,
    routes: mockRoutes.filter(route => route.parentId === mockServer._id),
  }));
  // set empty activeResponse if graphql websocket request and activeResponse is not websocket response
  if (isGraphqlWsRequest && activeResponse && !models.webSocketResponse.isWebSocketResponse(activeResponse)) {
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse: null,
      responses: [],
      requestVersions: [],
      mockServerAndRoutes,
    } as RequestLoaderData | WebSocketRequestLoaderData;
  }

  if (models.socketIORequest.isSocketIORequest(activeRequest)) {
    const socketIOPayload = await services.socketIOPayload.getOrCreateByParentId(requestId);
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse,
      responses,
      requestVersions: await services.requestVersion.findByParentId(requestId),
      mockServerAndRoutes,
      requestPayload: socketIOPayload,
    } as SocketIORequestLoaderData;
  }

  return {
    activeRequest,
    activeRequestMeta,
    activeResponse,
    responses,
    requestVersions: await services.requestVersion.findByParentId(requestId),
    mockServerAndRoutes,
  } as RequestLoaderData | WebSocketRequestLoaderData;
}

export function useRequestLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId',
  );
}
