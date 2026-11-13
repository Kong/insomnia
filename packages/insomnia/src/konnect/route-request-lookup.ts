import type { GrpcRequest, Request, WebSocketRequest, Workspace, WorkspaceChildrenForScope } from 'insomnia-data';
import { models } from 'insomnia-data';

import { getRouteIdFromKonnectRouteKey, type TraceSummaryBreakdown } from './debug-trace-helper';

export interface KonnectRouteRequest {
  request: Request | WebSocketRequest | GrpcRequest;
  workspaceId: string;
  workspaceName: string;
  routeId: string;
  /** Method and protocol segments of the konnectRouteKey. */
  method: string;
  protocol: string;
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
      if (!routeId) {
        return [];
      }
      // konnectRouteKey is `${route.id}:${method}:${pathSegment}:${protocol}`; the path may contain ':'.
      const segments = doc.konnectRouteKey!.split(':');
      const method = (segments[1] ?? '').toUpperCase();
      const protocol = (segments.at(-1) ?? '').toUpperCase();
      return [{ request: doc, workspaceId: workspace._id, workspaceName: workspace.name, routeId, method, protocol }];
    }),
  );
}

// Picks the local request for a trace: same Kong route, and the same HTTP method and protocol as the trace.
export function findRouteRequestForTrace(
  routeRequests: KonnectRouteRequest[],
  trace: Pick<TraceSummaryBreakdown, 'method' | 'urlScheme' | 'routeId'>,
): KonnectRouteRequest | null {
  const method = trace.method?.toUpperCase();
  return (
    routeRequests.find(
      candidate =>
        trace.routeId === candidate.routeId &&
        candidate.method.toUpperCase() === method &&
        candidate.protocol.toUpperCase() === trace.urlScheme?.toUpperCase(),
    ) ?? null
  );
}
