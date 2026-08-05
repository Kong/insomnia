import { href } from 'react-router';

import { syncProjects } from '~/ui/organization-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.sync-projects';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId } = params;

  await syncProjects(organizationId);

  return null;
}

export const useOrganizationSyncProjectsActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId }: { organizationId: string }) => {
      return submit(
        {},
        {
          method: 'POST',
          action: href(`/organization/:organizationId/sync-projects`, {
            organizationId,
          }),
        },
      );
    },
  clientAction,
);
