import { useAsync } from 'react-use';

import * as models from '../../../../models';
import type { GrpcRequest } from '../../../../models/grpc-request';
import * as protoLoader from '../../../../network/grpc/proto-loader';
import type { GrpcDispatch, GrpcRequestState } from '../../../context/grpc';
import { grpcActions } from '../../../context/grpc';

// Refresh methods as necessary
const useProtoFileReload = (
  { reloadMethods, running }: GrpcRequestState,
  grpcDispatch: GrpcDispatch,
  { _id, protoFileId }: GrpcRequest,
): void => {
  useAsync(async () => {
    // don't actually reload until the request has stopped running or if methods do not need to be reloaded
    if (!reloadMethods || running) {
      return;
    }

    grpcDispatch(grpcActions.clear(_id));

    console.log(`[gRPC] loading proto file methods pf=${protoFileId}`);
    const protoFile = await models.protoFile.getById(protoFileId);
    const methods = await protoLoader.loadMethods(protoFile);
    grpcDispatch(grpcActions.loadMethods(_id, methods));
  }, [_id, protoFileId, reloadMethods, grpcDispatch, running]);
};

export default useProtoFileReload;
