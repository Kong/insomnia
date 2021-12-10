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

  const updateAuthentication = useCallback((authentication: Request['authentication']) => patchRequest({ authentication }), [patchRequest]);

  return {
    activeRequest,
    updateAuthentication,
  };
};
