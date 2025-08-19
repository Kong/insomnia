import { useParams } from 'react-router';

import { useRequestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';
import { useRequestUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-meta';
import { useRequestUpdatePayloadActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-payload';
import { useRequestGroupUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';
import { useRequestGroupUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update-meta';
import { useWorkspaceUpdateMetaActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-meta';
import { useSettingsUpdateActionFetcher } from '~/routes/settings.update';

import type { GrpcRequest } from '../../models/grpc-request';
import type { GrpcRequestMeta } from '../../models/grpc-request-meta';
import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';
import type { RequestGroupMeta } from '../../models/request-group-meta';
import type { RequestMeta } from '../../models/request-meta';
import type { Settings } from '../../models/settings';
import type { SocketIOPayload } from '../../models/socket-io-payload';
import type { SocketIORequest } from '../../models/socket-io-request';
import type { WebSocketRequest } from '../../models/websocket-request';
import type { WorkspaceMeta } from '../../models/workspace-meta';
import { useInsomniaTabContext } from '../context/app/insomnia-tab-context';

export const useRequestPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestUpdateActionFetcher();
  return (
    requestId: string,
    patch: Partial<GrpcRequest> | Partial<Request> | Partial<WebSocketRequest> | Partial<SocketIORequest>,
  ) => {
    updateTabById?.(requestId, { temporary: false });
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
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestUpdateMetaActionFetcher();
  return (requestId: string, patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>) => {
    updateTabById?.(requestId, { temporary: false });
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
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestGroupUpdateActionFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroup>) => {
    updateTabById?.(requestGroupId, { temporary: false });
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
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestGroupUpdateMetaActionFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroupMeta>) => {
    updateTabById?.(requestGroupId, { temporary: false });
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
  return async (requestId: string, payload: Partial<SocketIOPayload>) => {
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
