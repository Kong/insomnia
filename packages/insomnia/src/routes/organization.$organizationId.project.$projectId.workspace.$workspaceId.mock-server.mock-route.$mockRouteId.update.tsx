import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { MockRoute } from '~/models/mock-route';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { mockRouteId } = params;

  const patch = (await request.json()) as Partial<MockRoute>;

  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');

  await models.mockRoute.update(mockRoute, patch);

  return null;
}

export function useMockRouteUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      mockRouteId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      mockRouteId: string;
      patch: Partial<MockRoute>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId/update',
        {
          organizationId,
          projectId,
          workspaceId,
          mockRouteId,
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
