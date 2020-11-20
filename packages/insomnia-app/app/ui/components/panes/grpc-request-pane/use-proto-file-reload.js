// @flow
import React from 'react';
import { grpcActions } from '../../../context/grpc';
import type { GrpcRequestState, GrpcDispatch } from '../../../context/grpc';
import type { GrpcRequest } from '../../../../models/grpc-request';

// Refresh methods as necessary
const useProtoFileReload = (
  { reloadMethods, running }: GrpcRequestState,
  grpcDispatch: GrpcDispatch,
  { _id, protoFileId }: GrpcRequest,
): void => {
  React.useEffect(() => {
    // don't actually reload until the request has stopped running or if methods do not need to be reloaded
    if (!reloadMethods || running) {
      return;
    }

    grpcDispatch(grpcActions.clear(_id));
    const func = async () => {
      grpcDispatch(await grpcActions.loadMethods(_id, protoFileId));
    };
    func();
  }, [_id, protoFileId, reloadMethods, grpcDispatch, running]);
};

export default useProtoFileReload;
