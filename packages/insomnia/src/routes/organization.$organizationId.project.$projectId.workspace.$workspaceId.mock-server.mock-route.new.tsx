import type { MockRoute } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { findConflictingMockRoute } from '~/ui/utils/mock-route';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.new';

type NewMockRoutePatch = { mockServerName?: string } & Partial<MockRoute>;

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  try {
    const patch = (await request.json()) as NewMockRoutePatch;
    invariant(typeof patch.name === 'string', 'Name is required');
    invariant(patch.name.startsWith('/'), 'Path must begin with a /');

    if (patch.parentId) {
      const existingRoutes = await services.mockRoute.findByParentId(patch.parentId);
      const method = patch.method ?? models.mockRoute.init().method;
      const hasRouteInServer = findConflictingMockRoute({
        existingRoutes,
        name: patch.name,
        method,
      });
      if (hasRouteInServer) {
        invariant(
          false,
          `Path "${patch.name}" with ${method} method already exists. Please enter a different path or method.`,
        );
      }
    }
    // TODO: remove this hack which enables a mock server to be created alongside a route
    // TODO: use an alternate method to create new workspace and server together
    // create a mock server under the workspace with the same name
    if (patch.mockServerName) {
      const collectionWorkspace = await services.workspace.getById(workspaceId);
      invariant(collectionWorkspace, 'Collection workspace not found');
      const mockWorkspace = await services.workspace.create({
        name: collectionWorkspace.name,
        scope: 'mock-server',
        parentId: projectId,
      });
      invariant(mockWorkspace, 'Workspace not found');
      const newMockServer = await services.mockServer.getOrCreateForParentId(mockWorkspace._id, {
        name: collectionWorkspace.name,
      });
      delete patch.mockServerName;
      const mockRoute = await services.mockRoute.create({ ...patch, parentId: newMockServer._id });

      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.mockRouteCreate,
      });

      return redirect(
        href(
          '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
          {
            organizationId,
            projectId,
            workspaceId: newMockServer.parentId,
            mockRouteId: mockRoute._id,
          },
        ),
      );
    }
    invariant(patch.parentId, 'parentId is required');
    const mockServer = await services.mockServer.getById(patch.parentId);
    invariant(mockServer, 'Mock server not found');
    const mockRoute = await services.mockRoute.create(patch);

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.mockRouteCreate,
      properties: {
        source: 'from_response',
      },
    });

    return redirect(
      href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
        {
          organizationId,
          projectId,
          workspaceId: mockServer.parentId,
          mockRouteId: mockRoute._id,
        },
      ),
    );
  } catch (err) {
    console.error('Error creating mock route:', err);
    return {
      error: err instanceof Error ? err.message : 'Failed to create mock route',
    };
  }
}

export const useMockRouteNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      patch: NewMockRoutePatch;
    }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: href(
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/new`,
          {
            organizationId,
            projectId,
            workspaceId,
          },
        ),
        encType: 'application/json',
      });
    },
  clientAction,
);
