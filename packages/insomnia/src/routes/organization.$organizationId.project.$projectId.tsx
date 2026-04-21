import { href, redirect, useRouteLoaderData } from 'react-router';

import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await services.project.getById(projectId);

  if (!project) {
    return redirect(href('/organization/:organizationId', { organizationId }));
  }

  return {
    activeProject: project,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}
