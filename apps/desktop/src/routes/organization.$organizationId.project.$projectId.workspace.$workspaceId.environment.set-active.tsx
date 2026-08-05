import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');

  await services.workspaceMeta.update(workspaceMeta, { activeEnvironmentId: environmentId || null });

  return null;
}

export const useSetActiveEnvironmentFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      environmentId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      environmentId: string;
    }) => {
      return submit(
        {
          environmentId,
        },
        {
          method: 'POST',
          action: href(
            '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/set-active',
            {
              organizationId,
              projectId,
              workspaceId,
            },
          ),
        },
      );
    },
  clientAction,
);
