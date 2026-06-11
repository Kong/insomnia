import { updateInvitationRole } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators.invites.$invitationId';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, invitationId } = params;

  const formData = await request.formData();

  const roleId = formData.get('roleId');
  invariant(typeof roleId === 'string', 'Role ID is required');

  try {
    const user = await services.userSession.get();
    const sessionId = user.id;

    const response = await updateInvitationRole({
      organizationId,
      invitationId,
      roleId,
      sessionId,
    });

    return response;
  } catch {
    throw new Error('Failed to reinvite member. Please try again.');
  }
}

export const useInviteFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, invitationId, roleId }: { organizationId: string; invitationId: string; roleId: string }) => {
      return submit(
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
  clientAction,
);
