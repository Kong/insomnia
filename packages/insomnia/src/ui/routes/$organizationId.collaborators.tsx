import type { LoaderFunction } from 'react-router';

import { userSession } from '../../models';
import { insomniaFetch } from '../insomniaFetch';

interface PaginatedList {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
}

export type CollaboratorType = 'invite' | 'member' | 'group';

interface CollaboratorMetadata {
  groupId?: string;
  invitationId?: string;
  roleId?: string;
  email?: string;
  userId?: string;
  expiresAt?: string;
  groupTotal?: number;
}

export interface Collaborator {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
  createdAt?: string;
  metadata: CollaboratorMetadata;
}

export type CollaboratorsListLoaderResult =
  | (PaginatedList & {
      collaborators: Collaborator[];
    })
  | Error;

export const collaboratorsListLoader: LoaderFunction = async ({
  params,
  request,
}): Promise<CollaboratorsListLoaderResult> => {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    // Construct the base path
    let path = `/v1/desktop/organizations/${organizationId}/collaborators?per_page=${searchParams.per_page || 25}`;

    // Append query parameters conditionally
    if (searchParams.page) {
      path += `&page=${searchParams.page}`;
    }

    if (searchParams.filter) {
      path += `&filter=${searchParams.filter}`;
    }

    const collaboratorsList = await insomniaFetch<CollaboratorsListLoaderResult>({
      method: 'GET',
      path,
      sessionId,
    });

    return collaboratorsList;
  } catch (err) {
    return new Error(err.message);
  }
};
