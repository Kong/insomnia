import { href, redirect } from 'react-router';

import * as models from '~/models';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'mockRoute not found');
  const { isSelected } = await request.json();

  await models.mockRoute.remove(mockRoute);

  window.main.trackSegmentEvent({
    event: SegmentEvent.mockRouteDelete,
  });

  if (isSelected) {
    return redirect(
      href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server', {
        organizationId,
        projectId,
        workspaceId,
      }),
    );
  }
  return null;
}

export const useMockRouteDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      mockRouteId,
      isSelected,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      mockRouteId: string;
      isSelected: boolean;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId/delete',
        {
          organizationId,
          projectId,
          workspaceId,
          mockRouteId,
        },
      );

      return submit(JSON.stringify({ isSelected }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
