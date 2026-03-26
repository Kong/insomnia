import { useParams } from 'react-router';

import type {
  GrpcRequest,
  GrpcRequestMeta,
  McpPayload,
  McpRequest,
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

import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';
import type { RequestGroupMeta } from '../../models/request-group-meta';
import type { RequestMeta } from '../../models/request-meta';

export const useRequestPatcher = () => {
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
      workspaceId,
    });
  };
};

export const useRequestMetaPatcher = () => {
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
      workspaceId,
      requestId,
      patch,
    });
  };
};

export const useRequestGroupPatcher = () => {
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
      workspaceId,
      requestGroupId,
      patch,
    });
  };
};

export const useRequestGroupMetaPatcher = () => {
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
      workspaceId,
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
