import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.move';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId } = params as { projectId: string };
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');

  invariant(typeof organizationId === 'string', 'Organization ID is required');

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  await services.project.update(project, {
    parentId: organizationId,
    // We move a project to another organization as local no matter what it was before
    remoteId: null,
  });

  return null;
}

export const useProjectMoveActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      currentOrganizationId,
      projectId,
      newOrganizationId,
    }: {
      currentOrganizationId: string;
      projectId: string;
      newOrganizationId: string;
    }) => {
      return submit(
        {
          organizationId: newOrganizationId,
        },
        {
          method: 'POST',
          action: href('/organization/:organizationId/project/:projectId/move', {
            organizationId: currentOrganizationId,
            projectId,
          }),
        },
      );
    },
  clientAction,
);
