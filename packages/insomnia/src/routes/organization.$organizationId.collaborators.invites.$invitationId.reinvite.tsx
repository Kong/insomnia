import { reinvite } from 'insomnia-api';
import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators.invites.$invitationId.reinvite';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, invitationId } = params;

  try {
    const user = await services.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await reinvite({
      organizationId,
      invitationId,
      sessionId,
    });

    return response;
  } catch {
    throw new Error('Failed to reinvite member. Please try again.');
  }
}

export const useReinviteFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, invitationId }: { organizationId: string; invitationId: string }) => {
      return submit(
        {},
        {
          action: href(`/organization/:organizationId/collaborators/invites/:invitationId/reinvite`, {
            organizationId,
            invitationId,
          }),
          method: 'POST',
        },
      );
    },
  clientAction,
);
