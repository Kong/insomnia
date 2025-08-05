import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'mockRoute not found');
  const { isSelected } = await request.json();

  await models.mockRoute.remove(mockRoute);
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

export function useMockRouteDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(JSON.stringify({ isSelected }), {
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
