import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const environment = await services.environment.getById(environmentId);
  const baseEnvironment = await services.environment.getByParentId(workspaceId);
  invariant(environment?._id !== baseEnvironment?._id, 'Cannot delete base environment');
  invariant(environment, 'Environment not found');

  await services.environment.remove(environment);

  return null;
}

export const useEnvironmentDeleteActionFetcher = createFetcherSubmitHook(
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
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/delete', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.set('environmentId', environmentId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
