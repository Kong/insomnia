import { type GrpcRequest, type Request, services, type SocketIORequest, type WebSocketRequest } from 'insomnia-data';

import { isNotNullOrUndefined } from '~/common/misc';

type TrackableRecentRequest = Request | WebSocketRequest | GrpcRequest | SocketIORequest;

export interface RecentProjectRequest {
  workspaceId: string;
  request: TrackableRecentRequest;
}

interface CachedProjectRecentRequest {
  requestId: string;
  workspaceId: string;
}

interface CachedProjectRecentRequestsPayload {
  recentRequests: CachedProjectRecentRequest[];
}

const MAX_RECENT_PROJECT_REQUESTS = 5;
const RECENT_PROJECT_REQUESTS_STORAGE_KEY_PREFIX = 'recent-project-requests';

const getRecentProjectRequestsStorageKey = (projectId: string) =>
  `${RECENT_PROJECT_REQUESTS_STORAGE_KEY_PREFIX}:${projectId}`;

const removeCachedProjectRecentRequests = (projectId: string) => {
  window.localStorage.removeItem(getRecentProjectRequestsStorageKey(projectId));
};

export const getCachedProjectRecentRequests = (projectId: string): CachedProjectRecentRequest[] => {
  try {
    const storedRecentRequests = window.localStorage.getItem(getRecentProjectRequestsStorageKey(projectId));

    if (!storedRecentRequests) {
      return [];
    }

    const payload = JSON.parse(storedRecentRequests) as Partial<CachedProjectRecentRequestsPayload>;

    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.recentRequests)) {
      removeCachedProjectRecentRequests(projectId);
      return [];
    }

    return payload.recentRequests.slice(0, MAX_RECENT_PROJECT_REQUESTS);
  } catch {
    removeCachedProjectRecentRequests(projectId);
    return [];
  }
};

export const recordProjectRecentRequest = ({
  projectId,
  requestId,
  workspaceId,
}: {
  projectId: string;
  requestId: string;
  workspaceId: string;
}) => {
  if (!projectId || !requestId || !workspaceId) {
    return;
  }

  const existingRecentRequests = getCachedProjectRecentRequests(projectId);
  const payload: CachedProjectRecentRequestsPayload = {
    recentRequests: [
      { requestId, workspaceId },
      ...existingRecentRequests.filter(storedRequest => storedRequest.requestId !== requestId),
    ].slice(0, MAX_RECENT_PROJECT_REQUESTS),
  };

  window.localStorage.setItem(getRecentProjectRequestsStorageKey(projectId), JSON.stringify(payload));
};

export const getProjectRecentRequests = async (projectId: string) => {
  const cachedRecentRequests = getCachedProjectRecentRequests(projectId);

  if (!projectId || cachedRecentRequests.length === 0) {
    return [];
  }

  const recentRequests = (
    await Promise.all(
      cachedRecentRequests.map(async ({ requestId, workspaceId }): Promise<RecentProjectRequest | null> => {
        try {
          const request = (await services.helpers.getRequestById(requestId)) as TrackableRecentRequest | null;

          if (!request) {
            return null;
          }

          return {
            workspaceId,
            request,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(isNotNullOrUndefined);

  return recentRequests;
};
