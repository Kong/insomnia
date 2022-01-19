import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../models';
import { isGrpcRequest } from '../../models/grpc-request';
import { Request } from '../../models/request';
import { selectActiveRequest } from '../redux/selectors';

export const useActiveRequest = () => {
  const activeRequest = useSelector(selectActiveRequest);

  if (!activeRequest) {
    throw new Error('Tried to load null request');
  }

  if (isGrpcRequest(activeRequest)) {
    throw new Error('Loaded GrpcRequest, expected to load Request');
  }

  const patchRequest = useCallback(async (patch: Partial<Request>) => {
    await models.request.update(activeRequest, patch);
  }, [activeRequest]);

  const updateAuth = useCallback((authentication: Request['authentication']) => patchRequest({ authentication }), [patchRequest]);

  const { authentication } = activeRequest;
  const patchAuth = useCallback((patch: Partial<Request['authentication']>) => updateAuth({ ...authentication, ...patch }), [authentication, updateAuth]);

  return {
    activeRequest,
    patchAuth,
  };
};
