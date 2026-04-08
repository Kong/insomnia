import { href } from 'react-router';

import type { WebSocketRequest } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import * as requestOperations from '~/models/helpers/request-operations';
import { SegmentEvent } from '~/ui/analytics';
import { updateMimeType } from '~/ui/components/dropdowns/content-type-dropdown';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';

const { getPathParametersFromUrl, isRequest } = models.request;

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const patch = await request.json();

  const isRequestURLChanged =
    (isRequest(req) || models.webSocketRequest.isWebSocketRequest(req)) && patch.url && patch.url !== req.url;

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

  if (req.name !== patch.name) {
    window.main.trackSegmentEvent({
      event: SegmentEvent.requestRenamed,
    });
  }

  return null;
}

export const useRequestUpdateActionFetcher = createFetcherSubmitHook(
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

      return submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
