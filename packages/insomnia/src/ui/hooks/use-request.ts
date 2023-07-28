
import { useFetcher, useParams } from 'react-router-dom';

import { GrpcRequest } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { Request } from '../../models/request';
import { RequestMeta } from '../../models/request-meta';
import { WebSocketRequest } from '../../models/websocket-request';

export const useRequestPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const requestMetaFetcher = useFetcher();
  return (requestId: string, patch: Partial<GrpcRequest> | Partial<Request> | Partial<WebSocketRequest>) => {
    requestMetaFetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const useRequestMetaPatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const requestMetaFetcher = useFetcher();
  return (requestId: string, patch: Partial<GrpcRequestMeta> | Partial<RequestMeta>) => {
    requestMetaFetcher.submit(patch, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update-meta`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export type CreateRequestType = 'HTTP' | 'gRPC' | 'GraphQL' | 'WebSocket' | 'Event Stream';
