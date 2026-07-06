import type { RequestGroup } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href, redirect, useRouteLoaderData } from 'react-router';

import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';

export interface RequestGroupLoaderData {
  activeRequestGroup: RequestGroup;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, requestGroupId, workspaceId } = params;

  const activeRequestGroup = await services.requestGroup.getById(requestGroupId);
  if (!activeRequestGroup) {
    showResourceNotFoundToast(`Folder not found: ${requestGroupId}`);
    throw redirect(
      href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
        organizationId,
        projectId,
        workspaceId,
      }),
    );
  }

  return {
    activeRequestGroup,
  };
}

export function useRequestGroupLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId',
  );
}
