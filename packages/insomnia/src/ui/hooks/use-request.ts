import { useFetcher, useParams } from 'react-router';

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
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useFetcher();
  return (
    requestId: string,
    patch: Partial<GrpcRequest> | Partial<Request> | Partial<WebSocketRequest> | Partial<SocketIORequest>,
  ) => {
    updateTabById?.(requestId, { temporary: false });
    fetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useRequestMetaPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useFetcher();
  return (requestId: string, patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>) => {
    updateTabById?.(requestId, { temporary: false });
    fetcher.submit(patch, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update-meta`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useRequestGroupPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroup>) => {
    updateTabById?.(requestGroupId, { temporary: false });
    fetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${requestGroupId}/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useRequestGroupMetaPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  const { updateTabById } = useInsomniaTabContext();
  const fetcher = useFetcher();
  return (requestGroupId: string, patch: Partial<RequestGroupMeta>) => {
    updateTabById?.(requestGroupId, { temporary: false });
    fetcher.submit(patch, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/${requestGroupId}/update-meta`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useSettingsPatcher = () => {
  const fetcher = useFetcher();
  return (patch: Partial<Settings>) => {
    fetcher.submit(JSON.stringify(patch), {
      action: '/settings/update',
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useWorkspaceMetaPatcher = () => {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const fetcher = useFetcher();
  return (workspaceId: string, patch: Partial<WorkspaceMeta>) => {
    fetcher.submit(patch, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/update-meta`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useRequestPayloadPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  const fetcher = useFetcher();
  return async (requestId: string, patch: Partial<SocketIOPayload>) => {
    await fetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update-payload`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL' | 'WebSocket' | 'Event Stream' | 'From Curl' | 'SocketIO';
