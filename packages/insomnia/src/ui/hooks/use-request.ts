import { useParams } from 'react-router';

import type {
  GrpcRequest,
  GrpcRequestMeta,
  McpPayload,
  McpRequest,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  Settings,
  SocketIOPayload,
  SocketIORequest,
  WebSocketRequest,
  WorkspaceMeta,
} from '~/insomnia-data';
import { useRequestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';
import { useRequestUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-meta';
import { useRequestUpdatePayloadActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-payload';
import { useRequestGroupUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';
import { useRequestGroupUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update-meta';
import { useWorkspaceUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-meta';
import { useSettingsUpdateActionFetcher } from '~/routes/settings.update';

export const useRequestPatcher = (requestWorkspaceId = '') => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestUpdateActionFetcher();
  return (
    requestId: string,
    patch:
      | Partial<GrpcRequest>
      | Partial<Request>
      | Partial<WebSocketRequest>
      | Partial<SocketIORequest>
      | Partial<McpRequest>,
  ) => {
    fetcher.submit({
      organizationId,
      patch,
      projectId,
      requestId,
      // If workspaceId is not available in params, use the workspaceId from the argument. This is used in global navigation side bar where workspaceId might not in the url params
      workspaceId: workspaceId || requestWorkspaceId,
    });
  };
};

export const useRequestMetaPatcher = (requestWorkspaceId = '') => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestUpdateMetaActionFetcher();
  return (requestId: string, patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>) => {
    fetcher.submit({
      organizationId,
      projectId,
      // If workspaceId is not available in params, use the workspaceId from the argument. This is used in global navigation side bar where workspaceId might not in the url params
      workspaceId: workspaceId || requestWorkspaceId,
      requestId,
      patch,
    });
  };
};

export const useRequestGroupPatcher = (requestWorkspaceId = '') => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestGroupUpdateActionFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroup>) => {
    fetcher.submit({
      organizationId,
      projectId,
      // If workspaceId is not available in params, use the workspaceId from the argument. This is used in global navigation side bar where workspaceId might not in the url params
      workspaceId: workspaceId || requestWorkspaceId,
      requestGroupId,
      patch,
    });
  };
};

export const useRequestGroupMetaPatcher = (requestWorkspaceId = '') => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestGroupUpdateMetaActionFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroupMeta>) => {
    fetcher.submit({
      organizationId,
      projectId,
      // If workspaceId is not available in params, use the workspaceId from the argument. This is used in global navigation side bar where workspaceId might not in the url params
      workspaceId: workspaceId || requestWorkspaceId,
      requestGroupId,
      patch,
    });
  };
};

export const useSettingsPatcher = () => {
  const fetcher = useSettingsUpdateActionFetcher();
  return (patch: Partial<Settings>) => {
    fetcher.submit({ patch });
  };
};

export const useWorkspaceMetaPatcher = () => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const fetcher = useWorkspaceUpdateMetaActionFetcher();
  return (workspaceId: string, patch: Partial<WorkspaceMeta>) => {
    fetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      patch,
    });
  };
};

export const useRequestPayloadPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestUpdatePayloadActionFetcher();
  return async (requestId: string, payload: Partial<SocketIOPayload> | Partial<McpPayload>) => {
    await fetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      payload,
    });
  };
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL' | 'WebSocket' | 'Event Stream' | 'From Curl' | 'SocketIO';
