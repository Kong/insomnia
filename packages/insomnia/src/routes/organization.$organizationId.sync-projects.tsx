import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { syncProjects } from '~/ui/organization-utils';

import type { Route } from './+types/organization.$organizationId.sync-projects';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId } = params;

  await syncProjects(organizationId);

  return null;
}

export function useOrganizationSyncProjectsActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ organizationId }: { organizationId: string }) => {
      return fetcherSubmit(
        {},
        {
          method: 'POST',
          action: href(`/organization/:organizationId/sync-projects`, {
            organizationId,
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
