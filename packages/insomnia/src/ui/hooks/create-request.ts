import * as models from '../../models';
import { isGrpcRequestId } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { RequestMeta } from '../../models/request-meta';
import { WorkspaceMeta } from '../../models/workspace-meta';

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
