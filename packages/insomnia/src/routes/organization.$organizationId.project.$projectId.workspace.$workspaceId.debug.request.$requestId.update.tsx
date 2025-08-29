import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as requestOperations from '~/models/helpers/request-operations';
import { getPathParametersFromUrl, isRequest } from '~/models/request';
import type { WebSocketRequest } from '~/models/websocket-request';
import { isWebSocketRequest } from '~/models/websocket-request';
import { updateMimeType } from '~/ui/components/dropdowns/content-type-dropdown';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const patch = await request.json();

  const isRequestURLChanged = (isRequest(req) || isWebSocketRequest(req)) && patch.url && patch.url !== req.url;

  if (isRequestURLChanged) {
    const { url } = patch as Request | WebSocketRequest;

    // Check the URL for path parameters and store them in the request
    const urlPathParameters = getPathParametersFromUrl(url);

    const pathParameters = urlPathParameters.map(name => ({
      name,
      value: req.pathParameters?.find(p => p.name === name)?.value || '',
    }));

    patch.pathParameters = pathParameters;
  }

  // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
  const isMimeTypeChanged = isRequest(req) && patch.body && patch.body.mimeType !== req.body.mimeType;
  if (isMimeTypeChanged) {
    await requestOperations.update(req, { ...patch, ...updateMimeType(req, patch.body?.mimeType) });
    return null;
  }

  await requestOperations.update(req, patch);

  return null;
}

export function useRequestUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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
      patch: any;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/update',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return fetcherSubmit(JSON.stringify(patch), {
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
