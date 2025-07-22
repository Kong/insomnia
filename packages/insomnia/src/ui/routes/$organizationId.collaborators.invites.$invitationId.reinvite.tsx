import type { ActionFunction } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

export const reinviteCollaboratorAction: ActionFunction = async ({ params }) => {
  const { organizationId, invitationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof invitationId === 'string', 'Invitation ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'POST',
      path: `/v1/organizations/${organizationId}/invites/${invitationId}/reinvite`,
      sessionId,
    });

    return response;
  } catch (err) {
    throw new Error('Failed to reinvite member. Please try again.');
  }
};
