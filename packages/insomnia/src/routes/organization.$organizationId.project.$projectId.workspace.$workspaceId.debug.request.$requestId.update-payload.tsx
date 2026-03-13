import { href } from 'react-router';

import { type McpPayload, services } from '~/insomnia-data';
import * as models from '~/models';
import type { SocketIOPayload } from '~/models/socket-io-payload';
import { isSocketIORequestId } from '~/models/socket-io-request';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-payload';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    const patch = (await request.json()) as Partial<McpPayload>;
    await services.mcpPayload.updateOrCreateByParentIdAndUrl(requestId, patch);
    return null;
  } else if (isSocketIORequestId(requestId)) {
    const patch = (await request.json()) as Partial<SocketIOPayload>;
    await models.socketIOPayload.updateOrCreateByParentId(requestId, patch);
  }

  return null;
}

export const useRequestUpdatePayloadActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      payload,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      payload: Partial<SocketIOPayload | McpPayload>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/update-payload',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );
      return submit(JSON.stringify(payload), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
