import { href } from 'react-router';

import type { GrpcRequestMeta } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import type { RequestMeta } from '~/models/request-meta';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-meta';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const patch = (await request.json()) as Partial<RequestMeta | GrpcRequestMeta>;
  if (models.grpcRequest.isGrpcRequestId(requestId)) {
    await services.grpcRequestMeta.updateOrCreateByParentId(requestId, patch);
    return null;
  }
  await models.requestMeta.updateOrCreateByParentId(requestId, patch);
  return null;
}

export const useRequestUpdateMetaActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      patch: Partial<RequestMeta | GrpcRequestMeta>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/update-meta',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
