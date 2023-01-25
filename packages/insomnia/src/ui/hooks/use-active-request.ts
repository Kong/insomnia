import { useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import * as requestOperations from '../../models/helpers/request-operations';
import { Request, RequestAuthentication } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';
export const useActiveRequest = () => {
  const activeRequest = useRouteLoaderData('request/:requestId') as Request;

  if (!activeRequest || !('authentication' in activeRequest)) {
    throw new Error('Tried to load invalid request type');
  }

  const updateAuth = useCallback((authentication: RequestAuthentication) => {
    requestOperations.update(activeRequest, { authentication });
  }, [activeRequest]);

  const { authentication } = activeRequest;
  const patchAuth = useCallback((patch: Partial<Request['authentication'] | WebSocketRequest['authentication']>) => updateAuth({ ...authentication, ...patch }), [authentication, updateAuth]);

  return {
    activeRequest,
    patchAuth,
  };
};
