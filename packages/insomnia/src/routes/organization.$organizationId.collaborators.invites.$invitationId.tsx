import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.collaborators.invites.$invitationId';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, invitationId } = params;

  const formData = await request.formData();

  const roleId = formData.get('roleId');
  invariant(typeof roleId === 'string', 'Role ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'PATCH',
      path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
      data: { roles: [roleId] },
      sessionId,
    });

    return response;
  } catch {
    throw new Error('Failed to reinvite member. Please try again.');
  }
}

export function useInviteFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ organizationId, invitationId, roleId }: { organizationId: string; invitationId: string; roleId: string }) => {
      return fetcherSubmit(
        { roleId },
        {
          action: href(`/organization/:organizationId/collaborators/invites/:invitationId`, {
            organizationId,
            invitationId,
          }),
          method: 'POST',
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
