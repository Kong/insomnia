import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.duplicate';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();

  const environmentId = formData.get('environmentId');

  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const environment = await services.environment.getById(environmentId);
  invariant(environment, 'Environment not found');

  const newEnvironment = await services.environment.duplicate(environment);

  return newEnvironment;
}

export const useEnvironmentDuplicateActionFetcher = createFetcherSubmitHook(
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
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/duplicate',
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
