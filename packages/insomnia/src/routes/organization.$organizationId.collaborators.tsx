import { href } from 'react-router';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators';

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

type CollaboratorsListResult =
  | (PaginatedList & {
      collaborators: Collaborator[];
    })
  | Error;

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
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

    const collaboratorsList = await insomniaFetch<CollaboratorsListResult>({
      method: 'GET',
      path,
      sessionId,
    });

    return collaboratorsList;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching collaborators';
    return new Error(errorMessage);
  }
}

export const useCollaboratorsFetcher = createFetcherLoadHook(
  load =>
    ({
      organizationId,
      page,
      per_page,
      filter,
    }: {
      organizationId: string;
      page?: number;
      per_page?: number;
      filter?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', String(page));
      if (per_page) queryParams.append('per_page', String(per_page));
      if (filter) queryParams.append('filter', filter);

      load(`${href(`/organization/:organizationId/collaborators`, { organizationId })}?${queryParams.toString()}`);
    },
  clientLoader,
);
