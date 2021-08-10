import { useEffect } from 'react';

import type { GrpcRequest } from '../../../../models/grpc-request';
import type { GrpcDispatch, GrpcRequestState } from '../../../context/grpc';
import { grpcActions } from '../../../context/grpc';

// Refresh methods as necessary
const useProtoFileReload = (
  { reloadMethods, running }: GrpcRequestState,
  grpcDispatch: GrpcDispatch,
  { _id, protoFileId }: GrpcRequest,
): void => {
  useEffect(() => {
    // don't actually reload until the request has stopped running or if methods do not need to be reloaded
    if (!reloadMethods || running) {
      return;
    }

    grpcDispatch(grpcActions.clear(_id));

    const func = async () => {
      // @ts-expect-error -- TSCONVERSION
      grpcDispatch(await grpcActions.loadMethods(_id, protoFileId));
    };

    func();
  }, [_id, protoFileId, reloadMethods, grpcDispatch, running]);
};

export default useProtoFileReload;
