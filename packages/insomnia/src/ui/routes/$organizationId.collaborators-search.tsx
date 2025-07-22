import type { ActionFunction, LoaderFunction } from 'react-router';

import { userSession } from '../../models';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

type CollaboratorType = 'invite' | 'member' | 'group';

interface CollaboratorSearchResultItem {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
}

export type CollaboratorSearchLoaderResult = CollaboratorSearchResultItem[];

export const collaboratorSearchLoader: LoaderFunction = async ({
  params,
  request,
}): Promise<CollaboratorSearchLoaderResult> => {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    const collaboratorsSearchList = await insomniaFetch<CollaboratorSearchLoaderResult>({
      method: 'GET',
      path: `/v1/desktop/organizations/${organizationId}/collaborators/search/${searchParams.query}`,
      sessionId,
    });

    return collaboratorsSearchList;
  } catch (err) {
    return [];
  }
};

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
