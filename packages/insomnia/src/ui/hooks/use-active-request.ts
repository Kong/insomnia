import { useCallback } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { Request, RequestAuthentication } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';
import { RequestLoaderData } from '../routes/request';
export const useActiveRequest = () => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData<Request, any>;
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };

  if (!activeRequest || !('authentication' in activeRequest)) {
    throw new Error('Tried to load invalid request type');
  }

  const updateAuth = useCallback((authentication: RequestAuthentication) => {
    requestFetcher.submit({ authentication },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update`,
        method: 'post',
        encType: 'application/json',
      });
  }, [organizationId, projectId, requestFetcher, requestId, workspaceId]);

  const { authentication } = activeRequest;
  const patchAuth = useCallback((patch: Partial<Request['authentication'] | WebSocketRequest['authentication']>) => updateAuth({ ...authentication, ...patch }), [authentication, updateAuth]);

  return {
    activeRequest,
    patchAuth,
  };
};
