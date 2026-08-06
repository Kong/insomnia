import { href } from 'react-router';

import { InsomniaContext } from '~/common/application-bootstrap';
import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.delete';

export async function clientAction({ request, params, context }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  await context.get(InsomniaContext).environment.deleteById(environmentId, workspaceId);

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
