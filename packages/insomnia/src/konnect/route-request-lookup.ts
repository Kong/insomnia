import type { GrpcRequest, Request, WebSocketRequest, Workspace, WorkspaceChildrenForScope } from 'insomnia-data';
import { models } from 'insomnia-data';

import { getRouteIdFromKonnectRouteKey } from './debug-trace-helper';

export interface KonnectRouteRequest {
  request: Request | WebSocketRequest | GrpcRequest;
  workspaceId: string;
  workspaceName: string;
  routeId: string;
}

// Local requests of the given workspaces that were synced from a Konnect route.
export function listKonnectRouteRequests(
  workspaces: Pick<Workspace, '_id' | 'name'>[],
  childrenByWorkspaceId: ReadonlyMap<string, WorkspaceChildrenForScope<'collection' | 'design'>>,
): KonnectRouteRequest[] {
  return workspaces.flatMap(workspace =>
    (childrenByWorkspaceId.get(workspace._id)?.data.requestsAndGroups ?? []).flatMap(doc => {
      if (
        !models.request.isRequest(doc) &&
        !models.webSocketRequest.isWebSocketRequest(doc) &&
        !models.grpcRequest.isGrpcRequest(doc)
      ) {
        return [];
      }
      const routeId = getRouteIdFromKonnectRouteKey(doc.konnectRouteKey);
      return routeId ? [{ request: doc, workspaceId: workspace._id, workspaceName: workspace.name, routeId }] : [];
    }),
  );
}

// Picks the local request for a trace: same Kong route, preferring the one with the trace's HTTP method.
export function findRouteRequestForTrace(
  routeRequests: KonnectRouteRequest[],
  traceRouteIds: ReadonlySet<string>,
  traceMethod: string | null | undefined,
): KonnectRouteRequest | null {
  const candidates = routeRequests.filter(candidate => traceRouteIds.has(candidate.routeId));
  const method = traceMethod?.toUpperCase();
  return (
    candidates.find(
      candidate => models.request.isRequest(candidate.request) && candidate.request.method.toUpperCase() === method,
    ) ??
    candidates[0] ??
    null
  );
}
