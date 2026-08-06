import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { InsomniaContext } from '~/common/application-bootstrap';
import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';

const { isRequest } = models.request;

export async function clientAction({ params, request, context }: Route.ClientActionArgs) {
  const { requestId } = params;

  const req = await services.helpers.getRequestById(requestId);
  invariant(req, 'Request not found');
  const patch = await request.json();

  // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
  const isMimeTypeChanged = isRequest(req) && patch.body && patch.body.mimeType !== req.body.mimeType;

  await context.get(InsomniaContext).request.updateById(requestId, patch);

  // mimeType changes replace the whole body/headers shape - skip the rename check below in that
  // case, matching the prior behavior of returning immediately after that kind of update.
  if (isMimeTypeChanged) {
    return null;
  }

  if (req.name !== patch.name) {
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestRenamed,
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
