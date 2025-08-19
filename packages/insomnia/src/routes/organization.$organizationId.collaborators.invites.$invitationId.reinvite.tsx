import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';

import type { Route } from './+types/organization.$organizationId.collaborators.invites.$invitationId.reinvite';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, invitationId } = params;

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'POST',
      path: `/v1/organizations/${organizationId}/invites/${invitationId}/reinvite`,
      sessionId,
    });

    return response;
  } catch {
    throw new Error('Failed to reinvite member. Please try again.');
  }
}

export function useReinviteFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((
    { organizationId, invitationId }: { organizationId: string; invitationId: string }
  ) => {
    return fetcherSubmit(
      {},
      {
        action: href(`/organization/:organizationId/collaborators/invites/:invitationId/reinvite`, {
          organizationId,
          invitationId,
        }),
        method: 'POST',
      },
    );
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
