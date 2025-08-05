import { useCallback } from 'react';
import { useFetcher } from 'react-router';

import { userSession } from '~/models';
import { syncOrganizations } from '~/ui/organization-utils';

import type { Route } from './+types/organization.sync';

export async function clientAction(_args: Route.ClientActionArgs) {
  const { id: sessionId, accountId } = await userSession.getOrCreate();

  if (sessionId) {
    await syncOrganizations(sessionId, accountId);
  }

  return null;
}

export function useOrganizationSyncActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(() => {
    return fetcherSubmit(
      {},
      {
        method: 'POST',
        action: '/organization/sync',
      },
    );
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
