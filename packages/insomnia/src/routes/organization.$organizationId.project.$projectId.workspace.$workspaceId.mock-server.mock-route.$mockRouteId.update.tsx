import type { MockRoute } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { findConflictingMockRoute } from '~/ui/utils/mock-route';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { mockRouteId } = params;

  try {
    const patch = (await request.json()) as Partial<MockRoute>;

    const mockRoute = await services.mockRoute.getById(mockRouteId);
    invariant(mockRoute, 'Mock route is required');

    if (patch.name !== undefined) {
      invariant(typeof patch.name === 'string', 'Name is required');
      invariant(patch.name.startsWith('/'), 'Path must begin with a /');

      const existingRoutes = await services.mockRoute.findByParentId(mockRoute.parentId);
      const method = patch.method || mockRoute.method;
      const hasRouteInServer = findConflictingMockRoute({
        existingRoutes,
        name: patch.name,
        method,
        excludeId: mockRouteId, // allow edits
      });
      if (hasRouteInServer) {
        invariant(
          false,
          `Path "${patch.name}" with ${method} method already exists. Please enter a different path or method.`,
        );
      }
    }

    await services.mockRoute.update(mockRoute, patch);

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.mockRouteEdit,
    });

    return null;
  } catch (err) {
    console.error('Error updating mock route:', err);
    return {
      error: err instanceof Error ? err.message : 'Failed to update mock route',
    };
  }
}

export const useMockRouteUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
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

      return submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
