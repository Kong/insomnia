import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { getMockServiceBinURL } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.generate-request-collection';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const mockServer = await services.mockServer.getByParentId(workspaceId);
  invariant(mockServer, 'Mock Server not found');

  const mockRoutes = await services.mockRoute.findByParentId(mockServer._id);

  const collectionWorkspace = await services.workspace.create({
    name: `${mockServer.name} Collection`,
    parentId: projectId,
    scope: 'collection',
  });

  const baseUrl = getMockServiceBinURL(mockServer, '').replace(/\/$/, '');

  await services.environment.create({
    name: 'Base Environment',
    parentId: collectionWorkspace._id,
    data: {
      mockbin_base_url: baseUrl,
    },
  });

  const requestFolder = await services.requestGroup.create({
    name: 'Mock Server Requests',
    parentId: collectionWorkspace._id,
  });

  await services.requestGroupMeta.create({ parentId: requestFolder._id, collapsed: false });

  for (const mockRoute of mockRoutes) {
    await services.request.create({
      name: `${mockRoute.name}`,
      url: '{{ mockbin_base_url }}' + mockRoute.name,
      method: mockRoute.method.toUpperCase(),
      parentId: requestFolder._id,
      description: `Generated from mock route: ${mockRoute.name}`,
      headers: [
        {
          name: 'insomnia-mock-method',
          value: mockRoute.method,
          disabled: false,
        },
      ],
    });
  }

  window.main.trackAnalyticsEvent({
    event: AnalyticsEvent.generateCollectionFromMock,
    properties: {
      count_requests: mockRoutes.length,
    },
  });

  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId,
      projectId,
      workspaceId: collectionWorkspace._id,
    }),
  );
}

export const useMockServerGenerateRequestCollectionActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/generate-request-collection',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
