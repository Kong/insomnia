// @flow

import React from 'react';
import type { GrpcRequest } from '../../../../models/grpc-request';
import type { GrpcDispatch } from '../../../context/grpc';
import * as models from '../../../../models';
import { grpcActions } from '../../../context/grpc';
import { showModal } from '../../modals';
import ProtoFilesModal from '../../modals/proto-files-modal';

type ChangeHandlers = {
  url: string => Promise<void>,
  body: string => Promise<void>,
  method: string => Promise<void>,
  protoFile: string => Promise<void>,
};

// This will create memoized change handlers for the url, body and method selection
const useChangeHandlers = (request: GrpcRequest, dispatch: GrpcDispatch): ChangeHandlers => {
  return React.useMemo(() => {
    const url = async (value: string) => {
      await models.grpcRequest.update(request, { url: value });
    };

    const body = async (value: string) => {
      await models.grpcRequest.update(request, { body: { ...request.body, text: value } });
    };

    const method = async (value: string) => {
      await models.grpcRequest.update(request, { protoMethodName: value });
      dispatch(grpcActions.clear(request._id));
    };

    const protoFile = async () => {
      showModal(ProtoFilesModal, {
        preselectProtoFileId: request.protoFileId,
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

    return { url, body, method, protoFile };
  }, [request, dispatch]);
};

export default useChangeHandlers;
