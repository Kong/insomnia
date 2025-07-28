import type { ActionFunction } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

export const updateMemberRoleAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, userId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof userId === 'string', 'User ID is required');

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
  } catch (err) {
    throw new Error('Failed to update organization member roles');
  }
};
