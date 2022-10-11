import { unreachableCase } from 'ts-assert-unreachable';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import {
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  METHOD_GET,
  METHOD_POST,
} from '../../common/constants';
import * as models from '../../models';
import { isGrpcRequestId } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { RequestMeta } from '../../models/request-meta';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { showModal } from '../components/modals';
import { ProtoFilesModal } from '../components/modals/proto-files-modal';

export const updateActiveWorkspaceMeta = async (
  patch: Partial<WorkspaceMeta>,
  workspaceId: string
) => {
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(
    workspaceId
  );

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

export const setActiveRequest = async (
  activeRequestId: string,
  workspaceId: string
) => {
  await updateActiveWorkspaceMeta({ activeRequestId }, workspaceId);
  await updateRequestMetaByParentId(activeRequestId, {
    lastActive: Date.now(),
  });
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL' | 'WebSocket';
type RequestCreator = (input: {
  parentId: string;
  requestType: CreateRequestType;
  workspaceId: string;
}) => Promise<void>;

export const createRequest: RequestCreator = async ({
  parentId,
  requestType,
  workspaceId,
}) => {
  switch (requestType) {
    case 'gRPC': {
      showModal(ProtoFilesModal, {
        onSave: async (protoFileId: string) => {
          const request = await models.grpcRequest.create({
            parentId,
            name: 'New Request',
            protoFileId,
          });
          models.stats.incrementCreatedRequests();
          setActiveRequest(request._id, workspaceId);
        },
      });
      break;
    }

    case 'GraphQL': {
      const request = await models.request.create({
        parentId,
        method: METHOD_POST,
        headers: [
          {
            name: 'Content-Type',
            value: CONTENT_TYPE_JSON,
          },
        ],
        body: {
          mimeType: CONTENT_TYPE_GRAPHQL,
          text: '',
        },
        name: 'New Request',
      });
      models.stats.incrementCreatedRequests();
      setActiveRequest(request._id, workspaceId);
      break;
    }

    case 'HTTP': {
      const request = await models.request.create({
        parentId,
        method: METHOD_GET,
        name: 'New Request',
      });
      models.stats.incrementCreatedRequests();
      setActiveRequest(request._id, workspaceId);
      break;
    }

    case 'WebSocket': {
      const request = await models.webSocketRequest.create({
        parentId,
        name: 'New WebSocket Request',
      });
      models.stats.incrementCreatedRequests();
      setActiveRequest(request._id, workspaceId);
      break;
    }

    default:
      unreachableCase(
        requestType,
        "tried to create a request but didn't specify the type"
      );
  }

  trackSegmentEvent(SegmentEvent.requestCreate, { requestType });
};
