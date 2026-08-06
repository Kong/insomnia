import type { UpdateEnvironmentPatch } from 'application';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { InsomniaContext } from '~/common/application-bootstrap';
import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.update';

export async function clientAction({ request, params, context }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const { environmentId, patch } = (await request.json()) as {
    environmentId: string;
    patch: UpdateEnvironmentPatch;
  };
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const baseEnvironment = await services.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const updatedEnvironment = await context.get(InsomniaContext).environment.updateById(environmentId, patch);

  return updatedEnvironment;
}

export const useEnvironmentUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      environmentId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      environmentId: string;
      patch: UpdateEnvironmentPatch;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/update', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(JSON.stringify({ environmentId, patch }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
