import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.members.$userId.roles';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, userId } = params;

  const formData = await request.formData();

  const roleId = formData.get('roleId');
  invariant(typeof roleId === 'string', 'Role ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'PATCH',
      path: `/v1/organizations/${organizationId}/members/${userId}/roles`,
      data: { roles: [roleId] },
      sessionId,
    });

    return response;
  } catch {
    return {
      error: 'Failed to update organization member roles',
    };
  }
}

export function useOrganizationMemberRolesActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ organizationId, userId, roleId }: { organizationId: string; userId: string; roleId: string }) => {
      const formData = new FormData();
      formData.set('roleId', roleId);

      return fetcherSubmit(formData, {
        method: 'POST',
        action: href(`/organization/:organizationId/members/:userId/roles`, {
          organizationId,
          userId,
        }),
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
