import { useCallback } from 'react';
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
  return useCallback(
    (
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
    },
    [fetcher, organizationId, projectId, updateTabById, workspaceId],
  );
};

export const useRequestMetaPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestUpdateMetaActionFetcher();
  return useCallback(
    (requestId: string, patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>) => {
      updateTabById?.(requestId, { temporary: false });
      fetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestId,
        patch,
      });
    },
    [fetcher, organizationId, projectId, updateTabById, workspaceId],
  );
};

export const useRequestGroupPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestGroupUpdateActionFetcher();
  return useCallback(
    (requestGroupId: string, patch: Partial<RequestGroup>) => {
      updateTabById?.(requestGroupId, { temporary: false });
      fetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestGroupId,
        patch,
      });
    },
    [fetcher, organizationId, projectId, updateTabById, workspaceId],
  );
};

export const useRequestGroupMetaPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useRequestGroupUpdateMetaActionFetcher();
  return useCallback(
    (requestGroupId: string, patch: Partial<RequestGroupMeta>) => {
      updateTabById?.(requestGroupId, { temporary: false });
      fetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestGroupId,
        patch,
      });
    },
    [fetcher, organizationId, projectId, updateTabById, workspaceId],
  );
};

export const useSettingsPatcher = () => {
  const fetcher = useSettingsUpdateActionFetcher();
  return useCallback(
    (patch: Partial<Settings>) => {
      fetcher.submit({ patch });
    },
    [fetcher],
  );
};

export const useWorkspaceMetaPatcher = () => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const fetcher = useWorkspaceUpdateMetaActionFetcher();
  return useCallback(
    (workspaceId: string, patch: Partial<WorkspaceMeta>) => {
      fetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        patch,
      });
    },
    [fetcher, organizationId, projectId],
  );
};

export const useRequestPayloadPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const fetcher = useRequestUpdatePayloadActionFetcher();
  return useCallback(
    async (requestId: string, payload: Partial<SocketIOPayload>) => {
      await fetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestId,
        payload,
      });
    },
    [fetcher, organizationId, projectId, workspaceId],
  );
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL' | 'WebSocket' | 'Event Stream' | 'From Curl' | 'SocketIO';
