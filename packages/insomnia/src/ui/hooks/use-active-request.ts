import * as requestOperations from '@insomnia/models/helpers/request-operations';
import { Request, RequestAuthentication } from '@insomnia/models/request';
import { WebSocketRequest } from '@insomnia/models/websocket-request';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { selectActiveRequest } from '../redux/selectors';

export const useActiveRequest = () => {
  const activeRequest = useSelector(selectActiveRequest);

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
