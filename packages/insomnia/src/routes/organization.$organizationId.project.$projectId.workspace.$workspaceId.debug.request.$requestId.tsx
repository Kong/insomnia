import { redirect, useRouteLoaderData } from 'react-router';

import { database } from '~/common/database';
import type { BaseModel } from '~/models';
import * as models from '~/models';
import { type GrpcRequest, isGrpcRequestId } from '~/models/grpc-request';
import type { GrpcRequestMeta } from '~/models/grpc-request-meta';
import * as requestOperations from '~/models/helpers/request-operations';
import type { MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import { isGraphqlSubscriptionRequest } from '~/models/request';
import { type Request } from '~/models/request';
import { type RequestMeta } from '~/models/request-meta';
import type { RequestVersion } from '~/models/request-version';
import type { Response } from '~/models/response';
import type { SocketIOPayload } from '~/models/socket-io-payload';
import { isSocketIORequest, type SocketIORequest } from '~/models/socket-io-request';
import type { SocketIOResponse } from '~/models/socket-io-response';
import { isWebSocketRequest, type WebSocketRequest } from '~/models/websocket-request';
import { isWebSocketResponse, type WebSocketResponse } from '~/models/websocket-response';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';

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
  activeResponse: null;
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
export interface RequestLoaderData {
  activeRequest: Request;
  activeRequestMeta: RequestMeta;
  activeResponse: Response | null;
  responses: Response[];
  requestVersions: RequestVersion[];
  mockServerAndRoutes: (MockServer & { routes: MockRoute[] })[];
}

const getResponseModelName = (request: Request | WebSocketRequest | SocketIORequest | GrpcRequest) => {
  const isGraphqlWsRequest = isGraphqlSubscriptionRequest(request);
  if (isWebSocketRequest(request) || isGraphqlWsRequest) {
    return 'webSocketResponse';
  }
  if (isSocketIORequest(request)) {
    return 'socketIOResponse';
  }
  return 'response';
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, requestId, workspaceId } = params;

  const activeRequest = await requestOperations.getById(requestId);
  if (!activeRequest) {
    throw redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
  }
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  // NOTE: loaders shouldnt mutate data, this should be moved somewhere else
  await models.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: requestId });
  if (isGrpcRequestId(requestId)) {
    return {
      activeRequest,
      activeRequestMeta: await models.grpcRequestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() }),
      activeResponse: null,
      responses: [],
      requestVersions: [],
    } as GrpcRequestLoaderData;
  }
  const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  invariant(activeRequestMeta, 'Request meta not found');
  const { filterResponsesByEnv } = await models.settings.get();
  const isGraphqlWsRequest = isGraphqlSubscriptionRequest(activeRequest);

  const responseModelName = getResponseModelName(activeRequest);

  const activeResponse = activeRequestMeta.activeResponseId
    ? await models[responseModelName].getById(activeRequestMeta.activeResponseId)
    : await models[responseModelName].getLatestForRequest(requestId, activeWorkspaceMeta.activeEnvironmentId);
  const allResponses = (await models[responseModelName].findByParentId(requestId)) as (
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
      const buffer = await models.response.getBodyBuffer(activeResponse);
      activeResponse.bodyBuffer = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    }
  }

  // Q(gatzjames): load mock servers here or somewhere else?
  const mockServers = await models.mockServer.findByProjectId(projectId);
  const mockRoutes = await database.find<MockRoute>(models.mockRoute.type, {
    parentId: { $in: mockServers.map(s => s._id) },
  });
  const mockServerAndRoutes = mockServers.map(mockServer => ({
    ...mockServer,
    routes: mockRoutes.filter(route => route.parentId === mockServer._id),
  }));
  // set empty activeResponse if graphql websocket request and activeResponse is not websocket response
  if (isGraphqlWsRequest && activeResponse && !isWebSocketResponse(activeResponse)) {
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse: null,
      responses: [],
      requestVersions: [],
      mockServerAndRoutes,
    } as RequestLoaderData | WebSocketRequestLoaderData;
  }

  if (isSocketIORequest(activeRequest)) {
    const socketIOPayload = await models.socketIOPayload.getOrCreateByParentId(requestId);
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse,
      responses,
      requestVersions: await models.requestVersion.findByParentId(requestId),
      mockServerAndRoutes,
      requestPayload: socketIOPayload,
    } as SocketIORequestLoaderData;
  }
  return {
    activeRequest,
    activeRequestMeta,
    activeResponse,
    responses,
    requestVersions: await models.requestVersion.findByParentId(requestId),
    mockServerAndRoutes,
  } as RequestLoaderData | WebSocketRequestLoaderData;
}

export function useRequestLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId',
  );
}
