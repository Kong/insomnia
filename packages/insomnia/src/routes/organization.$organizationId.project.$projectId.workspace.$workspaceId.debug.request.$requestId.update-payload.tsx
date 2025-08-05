import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { SocketIOPayload } from '~/models/socket-io-payload';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update-payload';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;

  const patch = (await request.json()) as Partial<SocketIOPayload>;

  await models.socketIOPayload.updateOrCreateByParentId(requestId, patch);

  return null;
}

export function useRequestUpdatePayloadActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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
      payload: Partial<SocketIOPayload>;
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

      return fetcherSubmit(JSON.stringify(payload), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
