import { href } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active-global';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');

  await models.workspaceMeta.update(workspaceMeta, { activeGlobalEnvironmentId: environmentId || null });

  return null;
}

export const useEnvironmentSetActiveGlobalActionFetcher = createFetcherSubmitHook(
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
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/set-active-global',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      const formData = new FormData();
      formData.set('environmentId', environmentId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
