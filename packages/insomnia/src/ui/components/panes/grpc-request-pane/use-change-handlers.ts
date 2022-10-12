import { useMemo } from 'react';

import * as models from '../../../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../../../models/grpc-request';
import type { GrpcDispatch } from '../../../context/grpc';
import { grpcActions } from '../../../context/grpc';
import { showModal } from '../../modals';
import { ProtoFilesModal } from '../../modals/proto-files-modal';

interface ChangeHandlers {
  url: (arg0: string) => Promise<void>;
  body: (arg0: string) => Promise<void>;
  method: (arg0: string) => Promise<void>;
  metadata: (arg0: GrpcRequestHeader[]) => Promise<void>;
  protoFile: () => Promise<void>;
}

// This will create memoized change handlers for the url, body and method selection
const useChangeHandlers = (request: GrpcRequest, dispatch: GrpcDispatch): ChangeHandlers => {
  return useMemo(() => {
    const url = async (value: string) => {
      await models.grpcRequest.update(request, {
        url: value,
      });
    };

    const body = async (value: string) => {
      await models.grpcRequest.update(request, {
        body: { ...request.body, text: value },
      });
    };

    const method = async (value: string) => {
      await models.grpcRequest.update(request, {
        protoMethodName: value,
      });
      dispatch(grpcActions.clear(request._id));
    };

    const metadata = async (values: GrpcRequestHeader[]) => {
      await models.grpcRequest.update(request, {
        metadata: values,
      });
    };

    const protoFile = async () => {
      showModal(ProtoFilesModal, {
        selected: request.protoFileId,
        onSave: async (protoFileId: string) => {
          if (request.protoFileId !== protoFileId) {
            const initial = models.grpcRequest.init();
            // Reset the body as it is no longer relevant
            await models.grpcRequest.update(request, {
              protoFileId,
              body: initial.body,
              protoMethodName: initial.protoMethodName,
            });
            dispatch(grpcActions.invalidate(request._id));
          }
        },
      });
    };

    return {
      url,
      body,
      method,
      metadata,
      protoFile,
    };
  }, [request, dispatch]);
};

export default useChangeHandlers;
