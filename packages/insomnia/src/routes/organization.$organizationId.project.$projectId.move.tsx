import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.move';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId } = params as { projectId: string };
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');

  invariant(typeof organizationId === 'string', 'Organization ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  await models.project.update(project, {
    parentId: organizationId,
    // We move a project to another organization as local no matter what it was before
    remoteId: null,
  });

  return null;
}

export function useProjectMoveActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      currentOrganizationId,
      projectId,
      newOrganizationId,
    }: {
      currentOrganizationId: string;
      projectId: string;
      newOrganizationId: string;
    }) => {
      return fetcherSubmit(
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
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
