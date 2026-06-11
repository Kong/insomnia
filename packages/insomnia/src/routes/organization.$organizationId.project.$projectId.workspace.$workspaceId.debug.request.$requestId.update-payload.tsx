import type { McpPayload, SocketIOPayload } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-payload';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    const patch = (await request.json()) as Partial<McpPayload>;
    await services.mcpPayload.updateOrCreateByParentIdAndUrl(requestId, patch);
    return null;
  } else if (models.socketIORequest.isSocketIORequestId(requestId)) {
    const patch = (await request.json()) as Partial<SocketIOPayload>;
    await services.socketIOPayload.updateOrCreateByParentId(requestId, patch);
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
