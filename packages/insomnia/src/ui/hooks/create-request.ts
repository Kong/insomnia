
import { useFetcher, useParams } from 'react-router-dom';

import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import { RequestMeta } from '../../models/request-meta';

export const useRequestMetaUpdateFetcher = () => {
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
