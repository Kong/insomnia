import { unreachableCase } from 'ts-assert-unreachable';

import * as models from '../models';
import { isGrpcRequestId } from '../models/grpc-request';
import { GrpcRequestMeta } from '../models/grpc-request-meta';
import { RequestMeta } from '../models/request-meta';
import { WorkspaceMeta } from '../models/workspace-meta';
import { showModal } from '../ui/components/modals';
import ProtoFilesModal from '../ui/components/modals/proto-files-modal';
import { RootState } from '../ui/redux/modules';
import { selectActiveWorkspace, selectActiveWorkspaceMeta } from '../ui/redux/selectors';
import { SegmentEvent, trackSegmentEvent } from './analytics';
import { CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from './constants';

export const updateActiveWorkspaceMeta = (state: RootState) => async (patch: Partial<WorkspaceMeta>) => {
  const activeWorkspaceMeta = selectActiveWorkspaceMeta(state);

  if (activeWorkspaceMeta) {
    await models.workspaceMeta.update(activeWorkspaceMeta, patch);
  }
};

export const updateRequestMetaByParentId = async (
  requestId: string,
  patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>
) => {
  if (isGrpcRequestId(requestId)) {
    await models.grpcRequestMeta.updateOrCreateByParentId(requestId, patch);
    return;
  }

  await models.requestMeta.updateOrCreateByParentId(requestId, patch);
};

export const setActiveRequest = (state: RootState) => async (activeRequestId: string) => {
  await updateActiveWorkspaceMeta(state)({ activeRequestId });
  await updateRequestMetaByParentId(activeRequestId, { lastActive: Date.now() });
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL';
type RequestCreator = (parentId: string, requestType: CreateRequestType) => Promise<void>;

export const createRequest = (state: RootState): RequestCreator => async (parentId, requestType) => {
  let requestId = '';

  switch (requestType) {
    case 'gRPC': {
      showModal(ProtoFilesModal, {
        onSave: async (protoFileId: string) => {
          const createdRequest = await models.grpcRequest.create({
            parentId,
            name: 'New Request',
            protoFileId,
          });
          models.stats.incrementCreatedRequests();
          requestId = createdRequest._id;
        },
      });
      break;
    }

    case 'GraphQL': {
      const request = await models.request.create({
        parentId,
        method: METHOD_POST,
        headers:[{
          name: 'Content-Type',
          value: CONTENT_TYPE_JSON,
        }],
        body:{
          mimeType: CONTENT_TYPE_GRAPHQL,
          text: '',
        },
        name: 'New Request',
      });
      models.stats.incrementCreatedRequests();
      requestId = request._id;
      break;
    }

    case 'HTTP': {
      const request = await models.request.create({
        parentId,
        method: METHOD_GET,
        name: 'New Request',
      });
      models.stats.incrementCreatedRequests();
      requestId = request._id;
      break;
    }

    default:
      unreachableCase(requestType, 'tried to create a request but didn\'t specify the type');
  }

  trackSegmentEvent(SegmentEvent.requestCreate, { requestType });
  setActiveRequest(state)(requestId);
};

export const createRequestForActiveWorkspace = (state: RootState) => async (requestType: CreateRequestType) => {
  const activeWorkspace = selectActiveWorkspace(state);
  if (!activeWorkspace) {
    return;
  }
  createRequest(state)(activeWorkspace._id, requestType);
};
