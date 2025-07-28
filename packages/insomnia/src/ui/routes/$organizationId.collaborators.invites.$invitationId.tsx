import type { ActionFunction } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

export const updateInvitationRoleAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, invitationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof invitationId === 'string', 'Invitation ID is required');

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
  } catch (err) {
    throw new Error('Failed to reinvite member. Please try again.');
  }
};
