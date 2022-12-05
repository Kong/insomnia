import { useRouteLoaderData } from 'react-router-dom';

import * as requestOperations from '../../models/helpers/request-operations';
import { Request } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';

export const useActiveRequest = () => {
  const activeRequest = useRouteLoaderData('request/:requestId') as Request;
  if (!activeRequest || !('authentication' in activeRequest)) {
    throw new Error('Tried to load invalid request type');
  }
  return {
    activeRequest,
    patchAuth: (patch: Partial<Request['authentication'] | WebSocketRequest['authentication']>) => requestOperations.update(activeRequest, { ...activeRequest.authentication, ...patch }),
  };
};
