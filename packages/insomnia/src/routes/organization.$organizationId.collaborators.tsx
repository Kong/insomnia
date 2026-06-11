import { getCollaborators } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators';

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const { id: sessionId } = await services.userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    const collaboratorsList = await getCollaborators({
      sessionId,
      organizationId,
      pageLimit: Number(searchParams.per_page) || 25,
      page: Number(searchParams.page) || 0,
      filter: searchParams.filter,
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
